#!/usr/bin/env python3
"""
Server runner with auto-restart on failure
"""
import subprocess
import sys
import time
import os

def run_server():
    while True:
        try:
            print("🚀 Starting Pixel Permutation Server...")
            # Запускаем сервер
            result = subprocess.run([
                sys.executable, "app.py", 
                "--host", "0.0.0.0", 
                "--port", "5000"
            ], check=True)
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Server crashed with exit code {e.returncode}")
            print("🔄 Restarting in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print("\n👋 Server stopped by user")
            break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            print("🔄 Restarting in 10 seconds...")
            time.sleep(10)

if __name__ == "__main__":
    run_server()