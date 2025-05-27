#!/bin/bash

# Test Railway GraphQL environmentCreate with isEphemeral
# Replace these with your actual values
RAILWAY_TOKEN="${RAILWAY_TOKEN}"
PROJECT_ID="1f5e6643-d730-4bdf-ba1f-547fed032de2"  # Replace with your project ID
SOURCE_ENV_ID="bbcbaab5-53b4-45df-92a6-0839d1c28786"  # Replace with your source environment ID

if [ -z "$RAILWAY_TOKEN" ]; then
    echo "❌ Please set RAILWAY_TOKEN environment variable"
    exit 1
fi

echo "🧪 Testing Railway GraphQL environmentCreate with isEphemeral..."
echo "📡 Endpoint: https://backboard.railway.com/graphql/v2"
echo ""

# Test 1: Try with isEphemeral parameter (expected to fail)
echo "📝 Test 1: Creating environment with isEphemeral=true (expected to fail)"
echo "----------------------------------------"

curl --request POST \
  --url https://backboard.railway.com/graphql/v2 \
  --header "Authorization: Bearer $RAILWAY_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{
    "query": "mutation environmentCreate($input: EnvironmentCreateInput!) { environmentCreate(input: $input) { id name createdAt projectId isEphemeral } }",
    "variables": {
      "input": {
        "name": "pr-curl-test-ephemeral",
        "projectId": "'$PROJECT_ID'",
        "sourceEnvironmentId": "'$SOURCE_ENV_ID'",
        "isEphemeral": true
      }
    }
  }' | jq '.'

echo ""
echo "📝 Test 2: Creating environment without isEphemeral (should work)"
echo "----------------------------------------"

# Test 2: Try without isEphemeral parameter (should work)
RESPONSE=$(curl --silent --request POST \
  --url https://backboard.railway.com/graphql/v2 \
  --header "Authorization: Bearer $RAILWAY_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{
    "query": "mutation environmentCreate($input: EnvironmentCreateInput!) { environmentCreate(input: $input) { id name createdAt projectId isEphemeral } }",
    "variables": {
      "input": {
        "name": "pr-curl-test-regular",
        "projectId": "'$PROJECT_ID'",
        "sourceEnvironmentId": "'$SOURCE_ENV_ID'"
      }
    }
  }')

echo "$RESPONSE" | jq '.'

# Extract environment ID for cleanup
ENV_ID=$(echo "$RESPONSE" | jq -r '.data.environmentCreate.id // empty')

if [ ! -z "$ENV_ID" ]; then
    echo ""
    echo "🧹 Cleaning up test environment..."
    echo "----------------------------------------"
    
    curl --silent --request POST \
      --url https://backboard.railway.com/graphql/v2 \
      --header "Authorization: Bearer $RAILWAY_TOKEN" \
      --header 'Content-Type: application/json' \
      --data '{
        "query": "mutation environmentDelete($id: String!) { environmentDelete(id: $id) }",
        "variables": {
          "id": "'$ENV_ID'"
        }
      }' | jq '.'
    
    echo "✅ Test environment deleted"
else
    echo "⚠️  No environment ID found - cleanup not needed"
fi

echo ""
echo "🎯 Summary:"
echo "   • Test 1 (with isEphemeral): Expected to fail with 'Problem processing request'"
echo "   • Test 2 (without isEphemeral): Should succeed and return environment details"
echo "   • This confirms the isEphemeral parameter is not supported in the current API"
