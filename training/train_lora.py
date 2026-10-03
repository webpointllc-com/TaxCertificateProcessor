#!/usr/bin/env python3
"""Fine-tune a LoRA adapter for the WebPoint own model on consented session data.

Runs on a rented GPU pod (one 24 GB card is enough for a 9B base with 4-bit QLoRA).
Typical run on a few thousand examples: well under an hour.

    pip install -r training/requirements.txt
    python training/train_lora.py --data training/data --out training/adapters/webpoint-v2

Output is a LoRA adapter folder (a few hundred MB), not a full model. vLLM loads it on top of
the same base model, so shipping a new version means uploading one small folder.
Never ship an adapter that has not passed training/eval_gate.py.
"""

import argparse
import json
import os
import sys

DEFAULT_BASE = os.environ.get("BASE_MODEL", "Qwen/Qwen3.5-9B")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="training/data", help="folder with train.jsonl from scripts/export-training.js")
    p.add_argument("--out", required=True, help="where to write the adapter, e.g. training/adapters/webpoint-v2")
    p.add_argument("--base", default=DEFAULT_BASE)
    p.add_argument("--epochs", type=float, default=2.0)
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument("--rank", type=int, default=16)
    p.add_argument("--max-len", type=int, default=4096)
    p.add_argument("--min-examples", type=int, default=200,
                   help="refuse to train on less than this; too little data makes the model worse, not better")
    return p.parse_args()


def load_rows(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            ex = json.loads(line)
            msgs = ex.get("messages") or []
            if len(msgs) >= 2 and msgs[-1].get("role") == "assistant":
                rows.append({"messages": msgs})
    return rows


def main():
    args = parse_args()
    train_path = os.path.join(args.data, "train.jsonl")
    rows = load_rows(train_path)
    print(f"loaded {len(rows)} training examples from {train_path}")
    if len(rows) < args.min_examples:
        print(f"STOP: {len(rows)} < --min-examples {args.min_examples}. Collect more consented sessions first.")
        sys.exit(2)

    # Heavy imports only after the cheap checks pass.
    import torch
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    model = AutoModelForCausalLM.from_pretrained(
        args.base,
        quantization_config=BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
        ),
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )

    lora = LoraConfig(
        r=args.rank,
        lora_alpha=args.rank * 2,
        lora_dropout=0.05,
        target_modules="all-linear",
        task_type="CAUSAL_LM",
    )

    config = SFTConfig(
        output_dir=args.out,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        logging_steps=10,
        save_strategy="no",
        bf16=True,
        gradient_checkpointing=True,
        max_length=args.max_len,
        report_to=[],
    )

    trainer = SFTTrainer(
        model=model,
        args=config,
        train_dataset=Dataset.from_list(rows),
        processing_class=tokenizer,
        peft_config=lora,
    )
    trainer.train()
    trainer.save_model(args.out)
    tokenizer.save_pretrained(args.out)

    with open(os.path.join(args.out, "webpoint_adapter.json"), "w", encoding="utf-8") as f:
        json.dump({"base_model": args.base, "examples": len(rows), "epochs": args.epochs,
                   "rank": args.rank, "lr": args.lr}, f, indent=2)
    print(f"adapter written to {args.out}. Next: python training/eval_gate.py")


if __name__ == "__main__":
    main()
