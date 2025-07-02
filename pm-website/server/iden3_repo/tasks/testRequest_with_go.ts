import { task } from "hardhat/config";
import fs from "fs";
import path from "path";

task("testRequest_with_go", "Runs the Go‐powered testRequest")
  .addPositionalParam("type",       "Schema type name")
  .addPositionalParam("attribute",  "Attribute to extract")
  .addPositionalParam("schemaFile", "Path to JSON-LD schema file")
  .setAction(async ({ type, attribute, schemaFile }, hre) => {
    // 1) load the file contents
    let raw: string;
    try {
      raw = fs.readFileSync(schemaFile, "utf-8");
    } catch (err) {
      console.error("❌ [TASK] Failed to read schemaFile:", schemaFile, err);
      throw err;
    }

    // 2) debug prints
    console.log("▶️ [TASK] schemaFile path:", schemaFile);
    console.log("▶️ [TASK] raw JSON (first 500 chars):\n", raw.slice(0, 500));
    console.log("▶️ [TASK] raw JSON ends with:", raw.slice(-100));

    // 3) invoke your Go wrapper
    const { main } = await import("../scripts/maintenance/testRequest_with_go");
    await main(type, attribute, raw);
  });
