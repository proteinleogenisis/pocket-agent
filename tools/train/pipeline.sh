#!/bin/sh
# Teacher Q&A → verified → dataset → LoRA fine-tune → fused model → WebLLM q4f16_1 → score on the held-out test.
# Run from a work folder holding venv/, ref/ (official 0.5B MLC metadata), math.jsonl and teacher.jsonl.
set -e
PY=./venv/bin/python
HERE=$(cd "$(dirname "$0")" && pwd)
cp "$HERE"/*.py "$HERE"/lora.yaml .
echo "== verify teacher answers"; $PY verify.py teacher.jsonl teacher_ok.jsonl
echo "== build dataset";        $PY build_data.py math.jsonl teacher_ok.jsonl data
echo "== train";                $PY -m mlx_lm.lora -c lora.yaml
echo "== fuse";                 $PY -m mlx_lm.fuse --model Qwen/Qwen2.5-0.5B-Instruct --adapter-path adapters --save-path fused
echo "== convert";              $PY to_mlc.py fused ref out_mlc; for f in vocab.json merges.txt tokenizer.json tokenizer_config.json; do [ -f out_mlc/$f ] || cp conv_base/$f out_mlc/; done
echo "== score (fused, full precision)"; $PY run_eval.py fused
echo "== score (4-bit, close to the iPad)"; $PY -m mlx_lm.convert --hf-path fused --mlx-path fused_q4 -q --q-bits 4 --q-group-size 32 >/dev/null; $PY run_eval.py fused_q4
echo "== done"
