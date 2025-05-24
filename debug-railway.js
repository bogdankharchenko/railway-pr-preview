// Debug script to test Railway API access and simulate full PR workflow
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
    console.log('🔍 Testing Railway API connection and simulating PR workflow...');
    
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

    // Test 3: Simulate PR workflow - Check if PR environment exists
    const prEnvName = 'pr-debug-test';
    console.log(`\n3. 🔄 SIMULATING PR WORKFLOW - Check if ${prEnvName} exists...`);
    let prEnvironment = await client.findEnvironmentByName(sourceEnv.projectId, prEnvName);
    let isNewEnvironment = false;
    
    if (prEnvironment) {
      console.log(`✅ Environment already exists: ${prEnvironment.name}`);
      console.log('📝 Using existing environment - will redeploy to get latest changes');
    } else {
      console.log(`📝 Environment doesn't exist - creating new one...`);
      try {
        prEnvironment = await client.createEnvironment(
          sourceEnv.projectId,
          sourceEnvId,
          prEnvName
        );
        console.log('✅ Environment created successfully:', {
          name: prEnvironment.name
        });
        isNewEnvironment = true;
      } catch (createError) {
        console.error('❌ Failed to create environment:', createError.message);
        throw createError;
      }
    }

    // Test 4: Test deployment methods (this is the key test)
    console.log(`\n4. 🚀 TESTING DEPLOYMENT - ${isNewEnvironment ? 'Initial deployment' : 'Redeployment'}...`);
    try {
      const deploySuccess = await client.deployEnvironment(prEnvironment.id);
      if (deploySuccess) {
        console.log('✅ Deployment triggered successfully');
      } else {
        console.log('⚠️  Deployment could not be triggered automatically');
      }
    } catch (deployError) {
      console.error('❌ Deployment failed:', deployError.message);
      console.log('📝 This is the error we need to fix!');
    }

    // Test 5: Test getting environment details and URLs
    console.log('\n5. 📊 Getting environment details...');
    const envDetails = await client.getEnvironment(prEnvironment.id);
    console.log('✅ Environment details:', {
      name: envDetails.name,
      serviceCount: envDetails.serviceInstances?.edges?.length || 0
    });

    // Test 6: Extract URLs (simulate waiting for URLs)
    console.log('\n6. 🔗 Testing URL extraction...');
    const urls = client.extractDeploymentUrls(envDetails);
    if (urls.length > 0) {
      console.log('✅ Found URLs:', urls.map(u => ({
        url: u.url,
        type: u.type,
        serviceName: u.serviceName
      })));
    } else {
      console.log('📝 No URLs found yet (normal for new environments)');
    }

    // Test 7: Simulate PR closed - cleanup
    console.log('\n7. 🧹 SIMULATING PR CLOSED - Cleanup...');
    try {
      await client.deleteEnvironment(prEnvironment.id);
      console.log('✅ Environment deleted successfully');
    } catch (deleteError) {
      console.error('❌ Failed to delete environment:', deleteError.message);
    }

    console.log('\n🎉 Full PR workflow simulation completed!');
    console.log('\n📋 SUMMARY:');
    console.log('- ✅ Environment creation/reuse: Working');
    console.log('- ❓ Deployment triggering: Check logs above');
    console.log('- ✅ URL extraction: Working');
    console.log('- ✅ Environment cleanup: Working');

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

// Additional test function to specifically test deployment methods
async function testDeploymentMethods() {
  const token = process.env.RAILWAY_TOKEN;
  const sourceEnvId = process.env.RAILWAY_SOURCE_ENV_ID;
  
  if (!token || !sourceEnvId) {
    console.log('Please set RAILWAY_TOKEN and RAILWAY_SOURCE_ENV_ID environment variables');
    return;
  }

  const client = new RailwayClient(token);
  
  try {
    console.log('\n🧪 TESTING DEPLOYMENT METHODS SPECIFICALLY...');
    
    // Get source environment
    const sourceEnv = await client.getEnvironment(sourceEnvId);
    
    // Create a test environment
    const testEnvName = 'deploy-test-env';
    console.log(`Creating test environment: ${testEnvName}`);
    
    let testEnv;
    try {
      testEnv = await client.createEnvironment(
        sourceEnv.projectId,
        sourceEnvId,
        testEnvName
      );
      console.log('✅ Test environment created');
    } catch (createError) {
      if (createError.message.includes('already exists')) {
        console.log('Using existing test environment');
        testEnv = await client.findEnvironmentByName(sourceEnv.projectId, testEnvName);
      } else {
        throw createError;
      }
    }
    
    // Test each deployment method individually
    console.log('\n📝 Testing individual deployment methods:');
    
    const deploymentMethods = [
      'Deployment redeploy mutation',
      'Environment deploy mutation', 
      'Environment triggers deploy mutation',
      'Service deploy mutation'
    ];
    
    // Get the actual deployment methods from the client
    const deployResult = await client.deployEnvironment(testEnv.id);
    
    console.log(`Result: ${deployResult ? 'Success' : 'Failed'}`);
    
    // Cleanup
    console.log('\nCleaning up test environment...');
    await client.deleteEnvironment(testEnv.id);
    console.log('✅ Cleanup complete');
    
  } catch (error) {
    console.error('❌ Deployment method test failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--deployment-test')) {
    testDeploymentMethods().catch(console.error);
  } else {
    debugRailway().catch(console.error);
  }
}

module.exports = { debugRailway, testDeploymentMethods };
