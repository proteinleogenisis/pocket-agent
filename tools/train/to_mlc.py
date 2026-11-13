"""Convert a Qwen2 (0.5B) Hugging Face checkpoint to WebLLM's q4f16_1 format, without the MLC toolchain.
Reproduces MLC's GroupQuantize (group 32, 4-bit, symmetric, max_int 7, 8 values per uint32) and its
tensor names (fused c_attn = q|k|v, gate_up_proj = gate|up). The output works with the stock
Qwen2-0.5B q4f16_1 WebGPU library, because only the weights change.
Usage: python to_mlc.py HF_DIR REF_DIR OUT_DIR
  REF_DIR holds the official mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC tensor-cache.json + mlc-chat-config.json.
  python to_mlc.py --check HF_DIR REF_DIR   compares against REF_DIR/params_shard_1.bin byte for byte.
"""
import json, os, shutil, sys
import numpy as np
import mlx.core as mx

GROUP, MAXQ = 32, 7


def quantize(w):
    """w: [out, in] float32 → (uint32 [out, in/8], float16 [out, in/32]), MLC q4f16_1 layout."""
    out, inn = w.shape
    # Matches the official converter except ±1 on exact .5 ties (float noise): checked with --check.
    g = w.astype(np.float16).reshape(out, inn // GROUP, GROUP)
    scale = (np.abs(g).max(axis=2) * np.float16(1 / MAXQ)).astype(np.float16)
    s = np.where(scale == 0, np.float16(1), scale)[..., None]
    q = np.clip(np.floor(g / s + np.float16(0.5)) + MAXQ, 0, 2 * MAXQ).astype(np.uint32).reshape(out, inn // 8, 8)
    packed = np.zeros((out, inn // 8), np.uint32)
    for j in range(8):
        packed |= q[:, :, j] << np.uint32(4 * j)
    return packed, scale


def load_hf(d):
    t = {}
    for f in sorted(os.listdir(d)):
        if f.endswith(".safetensors"):
            for k, v in mx.load(os.path.join(d, f)).items():
                t[k] = np.array(v.astype(mx.float32))
    return t


def f32(x):
    if x.dtype == np.uint16:  # raw bf16 bits
        return (x.astype(np.uint32) << 16).view(np.float32)
    return x.astype(np.float32)


def tensors(hf):
    """Yield (mlc_name, array) in the reference order."""
    for k in list(hf):
        hf[k] = f32(hf[k])

    def get(name):
        p = name.replace("model.", "model.", 1)
        if name.endswith("c_attn.weight") or name.endswith("c_attn.bias"):
            base, suf = name.rsplit(".c_attn.", 1)
            return np.concatenate([hf[f"{base}.{x}_proj.{suf}"] for x in "qkv"], 0)
        if name.endswith("gate_up_proj.weight"):
            base = name.rsplit(".gate_up_proj.", 1)[0]
            return np.concatenate([hf[f"{base}.gate_proj.weight"], hf[f"{base}.up_proj.weight"]], 0)
        return hf[p]
    return get


def build(hf_dir, ref_dir):
    ref = json.load(open(os.path.join(ref_dir, "tensor-cache.json")))
    get = tensors(load_hf(hf_dir))
    cache = {}
    for shard in ref["records"]:
        for r in shard["records"]:
            n = r["name"]
            if n.endswith(".q_weight") or n.endswith(".q_scale"):
                base = n.rsplit(".", 1)[0] + ".weight"
                if base not in cache:
                    cache.clear()
                    cache[base] = quantize(get(base))
                arr = cache[base][0 if n.endswith(".q_weight") else 1]
            else:
                arr = get(n).astype(np.float16)
            assert list(arr.shape) == r["shape"] and str(arr.dtype) == r["dtype"], (n, arr.shape, arr.dtype, r)
            yield shard["dataPath"], r, arr


def convert(hf_dir, ref_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    ref = json.load(open(os.path.join(ref_dir, "tensor-cache.json")))
    files = {}
    for path, r, arr in build(hf_dir, ref_dir):
        b = arr.tobytes()
        assert len(b) == r["nbytes"]
        f = files.get(path) or open(os.path.join(out_dir, path), "wb")
        files[path] = f
        f.seek(r["byteOffset"])
        f.write(b)
    for f in files.values():
        f.close()
    # Same metadata; drop per-shard md5s if present (they no longer match).
    for s in ref["records"]:
        s.pop("md5sum", None)
        s["nbytes"] = os.path.getsize(os.path.join(out_dir, s["dataPath"]))
    for name in ("tensor-cache.json", "ndarray-cache.json"):
        json.dump(ref, open(os.path.join(out_dir, name), "w"))
    shutil.copy(os.path.join(ref_dir, "mlc-chat-config.json"), out_dir)
    for f in ("tokenizer.json", "vocab.json", "merges.txt", "tokenizer_config.json"):
        src = os.path.join(hf_dir, f)
        if os.path.exists(src):
            shutil.copy(src, out_dir)
    print("wrote", out_dir)


def check(hf_dir, ref_dir):
    data = open(os.path.join(ref_dir, "params_shard_1.bin"), "rb").read()
    n = same = 0
    for path, r, arr in build(hf_dir, ref_dir):
        if path != "params_shard_1.bin":
            continue
        want = data[r["byteOffset"]:r["byteOffset"] + r["nbytes"]]
        got = arr.tobytes()
        eq = got == want
        if not eq and r["dtype"] == "uint32":
            a = np.frombuffer(got, np.uint32); b = np.frombuffer(want, np.uint32)
            nib = sum(((a >> (4 * j)) & 15) != ((b >> (4 * j)) & 15) for j in range(8)).sum()
            print(f"  {r['name']}: {nib} of {a.size * 8} nibbles differ")
        elif not eq:
            a = np.frombuffer(got, np.float16).astype(np.float32); b = np.frombuffer(want, np.float16).astype(np.float32)
            print(f"  {r['name']}: max diff {np.abs(a - b).max():.3g}")
        n += 1; same += eq
    print(f"{same}/{n} tensors identical in shard 1")


if __name__ == "__main__":
    if sys.argv[1] == "--check":
        check(sys.argv[2], sys.argv[3])
    else:
        convert(*sys.argv[1:4])
