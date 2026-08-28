# Backend Scripts

`seed_products_from_csv.py` imports the product catalog once the Green Builder Sustainable Product of the Year rows are assembled.

The importer expects:

```csv
id,brand,product,pillar,category,weight,summary,image_url,source_year,source_issue
```

The exact three-year product source extraction remains a higher-touch task because it depends on magazine archive/chatbot access, image usage decisions, and final editorial review.
