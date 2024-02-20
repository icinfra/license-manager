#!/Users/wanlinwang/spack/opt/spack/darwin-ventura-m1/apple-clang-14.0.3/python-3.10.8-b7rgkczw4yfgrkbgttbcbur3ksmwho5d/bin/python3


import sqlite3
import re
import argparse
import os
import sqlite3
from os.path import expanduser
from datetime import datetime, timezone
import dateparser

def parse_license_file(filename):
    with open(filename, 'r') as f:
        content = f.read()
        # Assuming HOSTID follows a recognizable pattern; adjust the regex as necessary
        hostid_match = re.search(r'Host Id:(.+)\n', content)
        hostid = hostid_match.group(1).strip() if hostid_match else 'Not Found'

        generated_timestamp_string = re.search(r'# +Date:(.+)\n', content).group(1).strip()
        generated_timestamp = dateparser.parse(generated_timestamp_string)
        # Convert the datetime object to UTC
        timestamp_utc = generated_timestamp.astimezone(timezone.utc)
        # Format the UTC datetime object for SQLite
        timestamp_string_in_utc = timestamp_utc.strftime("%Y-%m-%d %H:%M:%S")

        start_index = content.find("##     PRODUCT TO FEATURE MAPPING")
        products_data = content[start_index:].split("# Product Id  :")

    products = []
    for product_data in products_data[1:]:
        product = {}
        product['id'] = product_data.split(",")[0].strip()
        product['name'] = re.search(r'Product Name: (.+)', product_data).group(1).strip()
        product['version'] = re.search(r'\[Version: (.+?)\]', product_data).group(1).strip()
        product['features'] = re.findall(r'Feature: (.+?)\s*\[', product_data)
        product['dates'] = re.findall(r'Start Date: (.+?) Exp Date: (.+?)\s*Product Qty: (\d+)', product_data)
        products.append(product)
    return hostid, timestamp_string_in_utc, products

def store_to_db(hostid, generated_timestamp, products, filename, db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''CREATE TABLE IF NOT EXISTS LicenseFiles
                     (LicenseFileId INTEGER PRIMARY KEY AUTOINCREMENT, FileName TEXT UNIQUE, hostname TEXT, hostid TEXT, GeneratedTimestamp TEXT, lmgrd_port TEXT, vendor_daemon_port TEXT, lmgrd_file_id INTEGER, vendor_daemon_file_id INTEGER, options_file_id INTEGER)''')
    cursor.execute("INSERT OR IGNORE INTO LicenseFiles (FileName, hostid, GeneratedTimestamp) VALUES (?, ?, ?)", (filename, hostid, generated_timestamp,))
    cursor.execute("SELECT LicenseFileId FROM LicenseFiles WHERE hostid=? and GeneratedTimestamp=?", (hostid, generated_timestamp))
    print
    license_file_id = cursor.fetchone()[0]

    cursor.execute('''CREATE TABLE IF NOT EXISTS LicenseRelatedFiles
                     (ExecutableFileId INTEGER PRIMARY KEY AUTOINCREMENT, FileName TEXT UNIQUE)''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS Features
                     (FeatureId INTEGER PRIMARY KEY AUTOINCREMENT, FeatureName TEXT UNIQUE)''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS Products
                     (ProductId TEXT PRIMARY KEY, ProductName TEXT)''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS ProductFeatureRelation
                     (RelationId INTEGER PRIMARY KEY AUTOINCREMENT, ProductId TEXT, FeatureId INTEGER, 
                     FOREIGN KEY(ProductId) REFERENCES Products(ProductId), 
                     FOREIGN KEY(FeatureId) REFERENCES Features(FeatureId))''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS ProductDates
                     (Id INTEGER PRIMARY KEY AUTOINCREMENT, ProductId TEXT, StartDate DATE, EndDate DATE, Version TEXT, Quantity INTEGER, LicenseFileId INTEGER,
                     FOREIGN KEY(ProductId) REFERENCES Products(ProductId),
                     FOREIGN KEY(LicenseFileId) REFERENCES LicenseFiles(LicenseFileId))''')

    for product in products:
        cursor.execute("INSERT OR REPLACE INTO Products (ProductId, ProductName) VALUES (?, ?)", (product['id'], product['name']))

        for feature in product['features']:
            cursor.execute("INSERT OR IGNORE INTO Features (FeatureName) VALUES (?)", (feature,))
            cursor.execute("SELECT FeatureId FROM Features WHERE FeatureName=?", (feature,))
            feature_id = cursor.fetchone()[0]
            
            cursor.execute("SELECT 1 FROM ProductFeatureRelation WHERE ProductId=? AND FeatureId=?", (product['id'], feature_id))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO ProductFeatureRelation (ProductId, FeatureId) VALUES (?, ?)", (product['id'], feature_id))
        
        for start_date, end_date, quantity in product['dates']:
            cursor.execute("SELECT 1 FROM ProductDates WHERE ProductId=? AND StartDate=? AND EndDate=? AND Version=? AND LicenseFileId=?", (product['id'], start_date, end_date, product['version'], license_file_id))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO ProductDates (ProductId, StartDate, EndDate, Version, Quantity, LicenseFileId) VALUES (?, ?, ?, ?, ?, ?)", (product['id'], start_date, end_date, product['version'], quantity, license_file_id))

    conn.commit()
    conn.close()

def main():
    parser = argparse.ArgumentParser(description="Process License Files and Store to Database")
    parser.add_argument('license_files', metavar='N', type=str, nargs='+', help='License file(s) to process')
    
    args = parser.parse_args()

    # Get the home directory
    home = expanduser("~")

    # Define the directory and database path
    dir_path = os.path.join(home, '.license-manager')
    db_path = os.path.join(dir_path, 'license.db')

    # Create the directory if it doesn't exist
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)

    for filename in args.license_files:
        hostid, generated_timestamp, products = parse_license_file(filename)
        store_to_db(hostid, generated_timestamp, products, filename, db_path)

if __name__ == "__main__":
    main()
