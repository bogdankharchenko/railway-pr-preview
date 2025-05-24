// Debug script to test Railway API access
const RailwayClient = require('./src/railway-client');

async function debugRailway() {
  // Get from environment variables or replace with your actual values
  const token = process.env.RAILWAY_TOKEN || 'your-token-here';
  const sourceEnvId = process.env.RAILWAY_SOURCE_ENV_ID || 'your-env-id-here';

  if (token === 'your-token-here' || sourceEnvId === 'your-env-id-here') {
    console.log('Please set RAILWAY_TOKEN and RAILWAY_SOURCE_ENV_ID environment variables');
    console.log('Usage: RAILWAY_TOKEN=xxx RAILWAY_SOURCE_ENV_ID=yyy node debug-railway.js');
    return;
  }

  const client = new RailwayClient(token);

  try {
    console.log('🔍 Testing Railway API connection...');
    
    // Test 1: Get source environment
    console.log('\n1. Getting source environment...');
    const sourceEnv = await client.getEnvironment(sourceEnvId);
    console.log('✅ Source environment:', {
      name: sourceEnv.name
    });

    // Test 2: List environments in project
    console.log('\n2. Listing project environments...');
    const environments = await client.getEnvironmentsByProject(sourceEnv.projectId);
    console.log('✅ Found environments:', environments.map(env => ({
      name: env.name,
      isEphemeral: env.isEphemeral
    })));

    // Test 3: Check if test environment exists
    const testEnvName = 'test-debug-env';
    console.log(`\n3. Checking if ${testEnvName} exists...`);
    const existingEnv = await client.findEnvironmentByName(sourceEnv.projectId, testEnvName);
    
    if (existingEnv) {
      console.log('⚠️  Test environment already exists:', existingEnv.name);
      console.log('Deleting it first...');
      await client.deleteEnvironment(existingEnv.id);
      console.log('✅ Deleted existing test environment');
    }

    // Test 4: Try to create a test environment
    console.log(`\n4. Creating test environment: ${testEnvName}...`);
    try {
      const newEnv = await client.createEnvironment(
        sourceEnv.projectId,
        sourceEnvId,
        testEnvName
      );
      console.log('✅ Environment created successfully:', {
        name: newEnv.name
      });

      // Clean up
      console.log('\n5. Cleaning up test environment...');
      await client.deleteEnvironment(newEnv.id);
      console.log('✅ Test environment deleted');

    } catch (createError) {
      console.error('❌ Failed to create environment:', createError.message);
      throw createError;
    }

    console.log('\n🎉 All tests passed! Railway API is working correctly.');

  } catch (error) {
    console.error('\n❌ Error during Railway API test:', error.message);
    console.error('Full error:', error);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Check that your Railway token is valid');
      console.log('- Ensure the token has access to the project');
      console.log('- Try creating a new token from https://railway.com/account/tokens');
    }
    
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Check that the source environment ID is correct');
      console.log('- Ensure the environment exists and is accessible');
      console.log('- Verify you have access to the project containing this environment');
    }

    if (error.message.includes('400')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- The request format might be invalid');
      console.log('- Check environment name constraints (length, characters)');
      console.log('- Verify all required fields are provided');
    }
  }
}

// Run if called directly
if (require.main === module) {
  debugRailway().catch(console.error);
}

module.exports = { debugRailway };
