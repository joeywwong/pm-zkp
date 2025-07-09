import { task } from "hardhat/config";
import fs from "fs";
import path from "path";

task("testRequest_with_go", "Runs the Go‐powered testRequest")
  .addPositionalParam("type", "Schema type name")
  .addPositionalParam("attribute", "Attribute to extract")
  .addPositionalParam("schemaFile", "Path to JSON-LD schema file")
  .addPositionalParam("operatorStr", "Operator string")
  .addPositionalParam("valueParam", "Value parameter")
  .addPositionalParam("tokenID", "Token ID")
  .addPositionalParam("contextParam", "Context parameter")
  .setAction(async (args) => {
    //console.log('Received args:', args);
    // 1) load the file contents
    let raw: string;
    try {
      raw = fs.readFileSync(args.schemaFile, "utf-8");
    } catch (err) {
      console.error("❌ [TASK] Failed to read schemaFile:", args.schemaFile, err);
      throw err;
    }

    // 2) debug prints
    //console.log("▶️ [TASK] schemaFile path:", schemaFile);
    //console.log("▶️ [TASK] raw JSON (first 500 chars):\n", raw.slice(0, 500));
    //console.log("▶️ [TASK] raw JSON ends with:", raw.slice(-100));

    // 3) invoke your Go wrapper
    const { main } = await import("../scripts/maintenance/testRequest_with_go");
    await main(args.type, args.attribute, raw, args.operatorStr, args.valueParam, args.tokenID, args.contextParam);
  });
