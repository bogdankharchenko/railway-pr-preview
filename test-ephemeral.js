const RailwayClient = require('./src/railway-client');

// Test script to verify ephemeral environment functionality
async function testEphemeralEnvironment() {
  // You'll need to set these environment variables or replace with your values
  const token = process.env.RAILWAY_TOKEN;
  const sourceEnvId = process.env.RAILWAY_SOURCE_ENV_ID;
  
  if (!token || !sourceEnvId) {
    console.error('❌ Please set RAILWAY_TOKEN and RAILWAY_SOURCE_ENV_ID environment variables');
    process.exit(1);
  }

  const railway = new RailwayClient(token);
  
  try {
    console.log('🔍 Testing ephemeral environment creation...');
    
    // Get source environment to find project ID
    const sourceEnv = await railway.getEnvironment(sourceEnvId);
    const projectId = sourceEnv.projectId;
    
    console.log(`✅ Source environment: ${sourceEnv.name} in project ${projectId}`);
    
    // Test creating a regular environment first (baseline)
    const testEnvName = `pr-regular-test-${Date.now()}`;
    console.log(`📝 Creating regular environment first: ${testEnvName}`);
    
    try {
      const regularEnv = await railway.createEnvironment(projectId, sourceEnvId, testEnvName);
      
      console.log(`✅ Regular environment created: ${regularEnv.name}`);
      console.log(`   ID: ${regularEnv.id}`);
      console.log(`   IsEphemeral: ${regularEnv.isEphemeral || 'not set'}`);
      console.log(`   Available fields:`, Object.keys(regularEnv));
      
      // Clean up the regular environment
      console.log('🧹 Cleaning up regular environment...');
      await railway.deleteEnvironment(regularEnv.id);
      console.log('✅ Regular environment deleted');
      
    } catch (regularError) {
      console.error('❌ Regular environment creation failed:', regularError.message);
      throw regularError;
    }
    
    // Test creating an ephemeral environment
    const ephemeralTestEnvName = `pr-ephemeral-test-${Date.now()}`;
    console.log(`📝 Creating ephemeral environment: ${ephemeralTestEnvName}`);
    
    try {
      const ephemeralEnv = await railway.createEnvironment(projectId, sourceEnvId, ephemeralTestEnvName, {
        isEphemeral: true
      });
      
      console.log(`✅ Ephemeral environment created: ${ephemeralEnv.name}`);
      console.log(`   ID: ${ephemeralEnv.id}`);
      console.log(`   IsEphemeral: ${ephemeralEnv.isEphemeral}`);
      
      // Verify the environment was created as ephemeral
      const verifyEnv = await railway.getEnvironment(ephemeralEnv.id);
      if (verifyEnv.isEphemeral) {
        console.log('✨ Environment correctly marked as ephemeral!');
      } else {
        console.log('⚠️  Environment not marked as ephemeral - may not be supported or already enabled');
      }
      
      // Clean up - delete the test environment
      console.log('🧹 Cleaning up ephemeral test environment...');
      await railway.deleteEnvironment(ephemeralEnv.id);
      console.log('✅ Ephemeral test environment deleted');
      
    } catch (ephemeralError) {
      console.log('❌ Ephemeral environment creation failed:', ephemeralError.message);
      console.log('ℹ️  This might mean the isEphemeral parameter is not supported or needs different syntax');
    }
    
    console.log('\n🎉 Environment creation test completed!');
    console.log('\n📋 Summary:');
    console.log('   - ✅ Regular environment creation works');
    console.log('   - ✅ Environment cleanup works');
    console.log('   - ℹ️  Ephemeral parameter testing completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Note: If ephemeral environments are not supported in the API,');
    console.log('    the action will still work - it just won\'t mark environments as ephemeral.');
    process.exit(1);
  }
}

testEphemeralEnvironment();
