#!/usr/bin/env python3
"""
Backend Cleanup Script for Hostinger Deployment
Removes all unnecessary files before production upload
"""

import os
import shutil
import glob
from pathlib import Path

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BLUE}{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}{Colors.RESET}\n")

def print_success(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠ {text}{Colors.RESET}")

def print_error(text):
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")

def remove_directory(path):
    """Remove directory if exists"""
    if os.path.exists(path):
        try:
            shutil.rmtree(path)
            print_success(f"Deleted: {path}")
            return True
        except Exception as e:
            print_error(f"Failed to delete {path}: {e}")
            return False
    else:
        print_warning(f"Not found: {path}")
        return False

def remove_file(path):
    """Remove file if exists"""
    if os.path.exists(path):
        try:
            os.remove(path)
            print_success(f"Deleted: {path}")
            return True
        except Exception as e:
            print_error(f"Failed to delete {path}: {e}")
            return False
    else:
        print_warning(f"Not found: {path}")
        return False

def remove_pattern(pattern):
    """Remove files matching pattern"""
    files = glob.glob(pattern, recursive=True)
    count = 0
    for file in files:
        if os.path.isfile(file):
            try:
                os.remove(file)
                count += 1
            except Exception as e:
                print_error(f"Failed to delete {file}: {e}")
        elif os.path.isdir(file):
            try:
                shutil.rmtree(file)
                count += 1
            except Exception as e:
                print_error(f"Failed to delete {file}: {e}")
    
    if count > 0:
        print_success(f"Deleted {count} items matching: {pattern}")
    else:
        print_warning(f"No items found matching: {pattern}")
    
    return count

def main():
    print_header("🗑️  BACKEND CLEANUP FOR DEPLOYMENT")
    
    # Get script directory
    script_dir = Path(__file__).parent.absolute()
    os.chdir(script_dir)
    
    print(f"Working directory: {script_dir}\n")
    
    deleted_count = 0
    
    # 1. Remove Python cache
    print_header("Removing Python Cache Files")
    deleted_count += remove_pattern("**/__pycache__")
    deleted_count += remove_pattern("**/*.pyc")
    deleted_count += remove_pattern("**/*.pyo")
    deleted_count += remove_pattern(".pytest_cache")
    
    # 2. Remove virtual environment
    print_header("Removing Virtual Environment")
    if remove_directory("venv"):
        deleted_count += 1
    if remove_directory("env"):
        deleted_count += 1
    if remove_directory(".venv"):
        deleted_count += 1
    
    # 3. Remove environment files
    print_header("Removing Environment Files")
    if remove_file(".env"):
        deleted_count += 1
    if remove_file(".env.local"):
        deleted_count += 1
    
    # 4. Remove test files
    print_header("Removing Test Files")
    test_files = [
        "test_*.py",
        "test_all_workflows.py",
        "test_complete_system.py",
    ]
    for pattern in test_files:
        deleted_count += remove_pattern(pattern)
    
    # 5. Remove fix/migration scripts
    print_header("Removing Fix/Migration Scripts")
    fix_scripts = [
        "fix_*.py",
        "add_*.py",
        "update_*.py",
        "migrate_*.py",
        "delete_test_*.py",
    ]
    for pattern in fix_scripts:
        deleted_count += remove_pattern(pattern)
    
    # 6. Remove git files
    print_header("Removing Git Files")
    if remove_directory(".git"):
        deleted_count += 1
    if remove_file(".gitignore"):
        deleted_count += 1
    
    # 7. Remove IDE files
    print_header("Removing IDE Files")
    ide_folders = [".vscode", ".idea", "__pycache__"]
    for folder in ide_folders:
        if remove_directory(folder):
            deleted_count += 1
    
    # 8. List files to keep
    print_header("✅ Files TO KEEP (Upload These)")
    keep_files = [
        "app/",
        "passenger_wsgi.py",
        ".htaccess",
        "config.py",
        "requirements.txt",
        "create_coc_tables.py",
        "init_db.py",
        "export_database.py",
        "production_server.py",
    ]
    
    for file in keep_files:
        if os.path.exists(file):
            print_success(f"Keep: {file}")
        else:
            print_error(f"Missing: {file}")
    
    # Summary
    print_header("📊 CLEANUP SUMMARY")
    print(f"{Colors.GREEN}Total items deleted: {deleted_count}{Colors.RESET}")
    
    # Calculate folder size
    try:
        total_size = sum(f.stat().st_size for f in Path('.').rglob('*') if f.is_file())
        size_mb = total_size / (1024 * 1024)
        print(f"{Colors.BLUE}Current backend size: {size_mb:.2f} MB{Colors.RESET}")
    except Exception as e:
        print_warning(f"Could not calculate size: {e}")
    
    print_header("🎉 CLEANUP COMPLETE!")
    print(f"{Colors.GREEN}Backend is ready for Hostinger deployment!{Colors.RESET}\n")
    
    print("Next steps:")
    print("1. Build frontend: cd ../frontend && npm run build")
    print("2. Export database: python export_database.py")
    print("3. Upload backend to: public_html/api/")
    print("4. Upload frontend build to: public_html/")
    print("5. Import database to Hostinger MySQL")
    print("6. Configure environment variables on Hostinger\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Cleanup cancelled by user.{Colors.RESET}")
    except Exception as e:
        print(f"\n{Colors.RED}Error during cleanup: {e}{Colors.RESET}")
