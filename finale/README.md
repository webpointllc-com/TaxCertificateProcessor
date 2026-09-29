# finale — DR Production Results

Drop county/state production workbooks here. The extractors and LLM read this folder so they already know the document they are filling.

Current sheets (same 40 columns):

| File | Agency | Notes |
| --- | --- | --- |
| `OH-Hamilton-DR-ProductionResults09042026.xlsx` | OH-Hamilton | Hamilton County, Ohio. Parcel format `###-####-####-##`. |
| `CT-HartfordCity-DR-ProductionResults09042026.xlsx` | CT-HartfordCity | Hartford, Connecticut (city slot). Numeric tax id / parcel. |
| *(xlsx pending)* | IL-Sangamon | Sangamon, Illinois. One screenshot row is in `samples.json` until the workbook lands. |

On a Mac, copies from Downloads:

```bash
cp "/Users/billmccreary/Downloads/OH-Hamilton -DR-Production Results09042026 (1).xlsx" \
  finale/OH-Hamilton-DR-ProductionResults09042026.xlsx
cp "/Users/billmccreary/Downloads/CT-HartfordCity-DR-ProductionResults09042026.xlsx" \
  finale/CT-HartfordCity-DR-ProductionResults09042026.xlsx
npm run import:finale
```

Rules the program follows:

- Talk about the **whole row** for the parcel in that county/state.
- Isolate a **single column** only when the user names that field.
- Empty cells stay empty. Never invent a collector URL or a dollar amount.
- Parcel formats differ by county and are stored on that county's extractor (self-heal / user feedback).
