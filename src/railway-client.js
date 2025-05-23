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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  async createEnvironment(projectId, sourceEnvironmentId, name) {
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
    const query = `
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
    `;

    const variables = {
      projectId,
    };

    const result = await this.graphql(query, variables);
    return result.environments.edges.map(edge => edge.node);
  }

  async findEnvironmentByName(projectId, name) {
    const environments = await this.getEnvironmentsByProject(projectId);
    return environments.find(env => env.name === name);
  }
}

module.exports = RailwayClient;
