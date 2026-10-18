import os
import zipfile

def package():
    zip_name = "FAP-GPA-Calculator-v1.0.0.zip"
    include_files = [
        "manifest.json",
        "content.js",
        "content.css",
        "popup.html",
        "popup.js",
        "popup.css",
        "README.md"
    ]
    include_dirs = ["icons"]

    with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as z:
        for f in include_files:
            if os.path.exists(f):
                z.write(f, f)
                print(f"Added {f}")
        for d in include_dirs:
            if os.path.exists(d):
                for root, _, files in os.walk(d):
                    for file in files:
                        full_path = os.path.join(root, file)
                        arcname = os.path.relpath(full_path, ".")
                        z.write(full_path, arcname)
                        print(f"Added {arcname}")

    print(f"\n[DONE] Package created successfully: {os.path.abspath(zip_name)}")

if __name__ == "__main__":
    package()
