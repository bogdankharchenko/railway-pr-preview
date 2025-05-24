const fetch = require('node-fetch');

class RailwayClient {
  constructor(token) {
    this.token = token;
    this.endpoint = 'https://backboard.railway.com/graphql/v2';
  }

  async graphql(query, variables = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Railway API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });
      throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Railway API response:', responseText);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  async createEnvironment(projectId, sourceEnvironmentId, name) {
    // Validate inputs
    if (!projectId || !sourceEnvironmentId || !name) {
      throw new Error(`Missing required parameters: projectId=${projectId}, sourceEnvironmentId=${sourceEnvironmentId}, name=${name}`);
    }

    // Validate environment name (Railway has specific naming requirements)
    if (name.length > 50) {
      throw new Error(`Environment name too long (${name.length} chars). Must be 50 characters or less: ${name}`);
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      throw new Error(`Invalid environment name format: ${name}. Only alphanumeric characters, hyphens, and underscores are allowed.`);
    }

    const query = `
      mutation environmentCreate($input: EnvironmentCreateInput!) {
        environmentCreate(input: $input) {
          id
          name
          createdAt
          projectId
          deploymentTriggers {
            edges {
              node {
                id
                environmentId
                branch
                projectId
              }
            }
          }
          serviceInstances {
            edges {
              node {
                id
                serviceId
                domains {
                  serviceDomains {
                    domain
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      input: {
        name,
        projectId,
        sourceEnvironmentId,
      },
    };



    const result = await this.graphql(query, variables);
    return result.environmentCreate;
  }

  async deleteEnvironment(environmentId) {
    const query = `
      mutation environmentDelete($id: String!) {
        environmentDelete(id: $id)
      }
    `;

    const variables = {
      id: environmentId,
    };

    await this.graphql(query, variables);
    return true;
  }

  async getEnvironment(environmentId) {
    const query = `
      query environment($id: String!) {
        environment(id: $id) {
          id
          name
          createdAt
          projectId
          serviceInstances {
            edges {
              node {
                id
                serviceId
                serviceName
                domains {
                  serviceDomains {
                    domain
                    id
                  }
                  customDomains {
                    domain
                    id
                  }
                }
                latestDeployment {
                  id
                  url
                  status
                  staticUrl
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      id: environmentId,
    };

    const result = await this.graphql(query, variables);
    return result.environment;
  }

  async waitForDeploymentUrls(environmentId, maxWaitTimeMs = 120000, checkIntervalMs = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTimeMs) {
      const env = await this.getEnvironment(environmentId);
      const urls = this.extractDeploymentUrls(env);
      
      if (urls.length > 0) {
        return { environment: env, urls };
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    
    // Return environment even if no URLs found
    const env = await this.getEnvironment(environmentId);
    return { environment: env, urls: [] };
  }

  extractDeploymentUrls(environment) {
    const urls = [];
    
    if (environment?.serviceInstances?.edges) {
      for (const serviceEdge of environment.serviceInstances.edges) {
        const service = serviceEdge.node;
        const serviceName = service.serviceName || 'Service';
        
        // Railway service domains (subdomain.railway.app)
        if (service.domains?.serviceDomains) {
          for (const domain of service.domains.serviceDomains) {
            urls.push({
              url: `https://${domain.domain}`,
              type: 'service',
              serviceName: serviceName,
              domain: domain.domain
            });
          }
        }
        
        // Custom domains
        if (service.domains?.customDomains) {
          for (const domain of service.domains.customDomains) {
            urls.push({
              url: `https://${domain.domain}`,
              type: 'custom',
              serviceName: serviceName,
              domain: domain.domain
            });
          }
        }
        
        // Deployment URLs (fallback)
        if (service.latestDeployment?.url) {
          urls.push({
            url: service.latestDeployment.url,
            type: 'deployment',
            serviceName: serviceName,
            domain: new URL(service.latestDeployment.url).hostname
          });
        }
        
        // Static URLs
        if (service.latestDeployment?.staticUrl) {
          urls.push({
            url: service.latestDeployment.staticUrl,
            type: 'static',
            serviceName: serviceName,
            domain: new URL(service.latestDeployment.staticUrl).hostname
          });
        }
      }
    }
    
    // Remove duplicates
    const uniqueUrls = urls.filter((url, index, self) => 
      index === self.findIndex(u => u.url === url.url)
    );
    
    return uniqueUrls;
  }

  async deployEnvironment(environmentId) {
    const query = `
      mutation environmentTriggersDeploy($input: EnvironmentTriggersDeployInput!) {
        environmentTriggersDeploy(input: $input)
      }
    `;

    const variables = {
      input: {
        environmentId,
      },
    };

    await this.graphql(query, variables);
    return true;
  }

  async getEnvironmentsByProject(projectId) {
    // Try different query structures to find what works
    const queries = [
      // Try project-based query first (more common pattern)
      {
        name: "Project-based environments query",
        query: `
          query project($id: String!) {
            project(id: $id) {
              id
              name
              environments {
                edges {
                  node {
                    id
                    name
                    isEphemeral
                  }
                }
              }
            }
          }
        `,
        variables: { id: projectId },
        transform: (data) => data.project.environments.edges.map(edge => edge.node)
      },
      // Original environments query
      {
        name: "Original environments query",
        query: `
          query environments($projectId: String!) {
            environments(projectId: $projectId) {
              edges {
                node {
                  id
                  name
                  isEphemeral
                  meta
                }
              }
            }
          }
        `,
        variables: { projectId },
        transform: (data) => data.environments.edges.map(edge => edge.node)
      },
      // Try simplified environments query
      {
        name: "Simplified environments query",
        query: `
          query environments($projectId: String!) {
            environments(projectId: $projectId) {
              id
              name
              isEphemeral
            }
          }
        `,
        variables: { projectId },
        transform: (data) => Array.isArray(data.environments) ? data.environments : [data.environments]
      }
    ];

    let lastError;
    for (const queryConfig of queries) {
      try {
        console.log(`Trying: ${queryConfig.name}`);
        const result = await this.graphql(queryConfig.query, queryConfig.variables);
        const environments = queryConfig.transform(result);
        console.log(`✅ Success with: ${queryConfig.name}`);
        return environments;
      } catch (error) {
        console.log(`❌ Failed with: ${queryConfig.name} - ${error.message}`);
        lastError = error;
        continue;
      }
    }
    
    throw lastError;
  }

  async findEnvironmentByName(projectId, name) {
    const environments = await this.getEnvironmentsByProject(projectId);
    return environments.find(env => env.name === name);
  }
}

module.exports = RailwayClient;
