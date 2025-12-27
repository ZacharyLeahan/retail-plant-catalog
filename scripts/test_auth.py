#!/usr/bin/env python3
"""
Basic authentication test script for Plant Agents Collective API.
Tests Bearer token authentication using credentials from .env file.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import requests

def test_auth():
    """Test API authentication with Bearer token."""
    
    # Load environment variables from .env file in parent directory
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
    
    # Get API credentials from environment
    base_url = os.getenv('PAC_STAGE_API_BASE_URL')
    api_key = os.getenv('PAC_STAGE_API_KEY')
    
    # Validate that credentials are loaded
    if not base_url:
        print("❌ Error: PAC_STAGE_API_BASE_URL not found in .env file")
        sys.exit(1)
    
    if not api_key:
        print("❌ Error: PAC_STAGE_API_KEY not found in .env file")
        sys.exit(1)
    
    print(f"✅ Loaded credentials from .env")
    print(f"   Base URL: {base_url}")
    print(f"   API Key: {api_key[:20]}...{api_key[-10:]}")
    print()
    
    # Prepare headers with Bearer token
    headers = {
        'Authorization': api_key,
        'accept': 'text/plain'
    }
    
    # Test endpoint - using a simple plant search
    test_endpoint = f"{base_url}/Plant/FindByName"
    test_params = {'plantName': 'milkweed'}
    
    print(f"🔍 Testing authentication...")
    print(f"   Endpoint: {test_endpoint}")
    print(f"   Method: GET")
    print()
    
    try:
        # Make the API request
        response = requests.get(test_endpoint, params=test_params, headers=headers, timeout=10)
        
        # Check response status
        if response.status_code == 200:
            print("✅ Authentication successful!")
            print(f"   Status Code: {response.status_code}")
            print()
            
            # Try to parse and display response
            try:
                data = response.json()
                print(f"   Response: {len(data)} plant(s) found")
                if data:
                    print(f"   First result: {data[0].get('symbol', 'N/A')} - {data[0].get('blurb', 'N/A')[:50]}...")
            except:
                print(f"   Response: {response.text[:100]}...")
            
            return True
        elif response.status_code == 401:
            print("❌ Authentication failed!")
            print(f"   Status Code: {response.status_code} (Unauthorized)")
            print(f"   Response: {response.text}")
            return False
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

if __name__ == "__main__":
    success = test_auth()
    sys.exit(0 if success else 1)







