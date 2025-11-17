import pandas as pd
import numpy as np
import math
import os

# --- CONFIGURATION ---
file_name = 'Base Poc import.csv'
lines_per_file = 30000  # Adjust this if you want smaller/larger chunks
# ---------------------

def split_csv():
    print(f"Attempting to load {file_name}...")
    
    # 1. Try to load with 'latin1' encoding (best for Excel/Windows files)
    #    and use engine='python' to auto-detect the separator (; or ,)
    try:
        df = pd.read_csv(file_name, sep=None, engine='python', encoding='latin1')
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Show what we found to be sure it worked
    num_rows = len(df)
    print(f"✅ Successfully loaded.")
    print(f"   - Rows detected: {num_rows}")
    print(f"   - Columns detected: {len(df.columns)}")
    print(f"   - Column names: {list(df.columns)}")
    
    # 2. Calculate splits
    num_files = math.ceil(num_rows / lines_per_file)
    print(f"\nSplitting into {num_files} files (approx {lines_per_file} rows each)...")

    # 3. Split and Save
    df_chunks = np.array_split(df, num_files)
    
    base_name = os.path.splitext(file_name)[0]
    
    for i, chunk in enumerate(df_chunks):
        part_num = i + 1
        output_file = f"{base_name}_part_{part_num}.csv"
        
        # Save with standard comma separator for Supabase
        chunk.to_csv(output_file, index=False, sep=',', encoding='utf-8')
        print(f"   -> Created: {output_file}")

    print("\nDone! You can now upload these part files to Supabase.")

if __name__ == "__main__":
    split_csv()