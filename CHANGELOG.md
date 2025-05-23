# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-23

### Added
- Initial release of Railway PR Preview Action
- Automatic environment creation for PRs
- Environment cleanup on PR close/merge
- **Enhanced URL Discovery System**
  - Smart detection of service domains, custom domains, and deployment URLs
  - Progressive comment updates with real deployment URLs
  - Support for multi-service projects
  - Configurable URL waiting behavior
- PR commenting with deployment URLs and live status
- Support for custom environment naming
- Configurable deployment triggering
- Comprehensive error handling and logging
- Support for both pull_request and push events

### Features
- ✅ Automatic environment lifecycle management
- ✅ Clones configuration from source environment  
- ✅ Supports custom environment naming
- ✅ **Smart URL discovery and display**
- ✅ **Progressive comment updates (Creating → Ready with URLs)**
- ✅ **Multi-service URL support**
- ✅ Posts deployment URLs in PR comments
- ✅ Handles PR reopening and synchronization
- ✅ Clean environment deletion on PR close
- ✅ Configurable deployment triggering
- ✅ Configurable URL waiting timeout
- ✅ No project_id required - derives from source environment

### Technical Details
- Built with Node.js 20
- Uses Railway's GraphQL API v2
- Integrates with the GitHub Actions ecosystem
- Comprehensive error handling
- Detailed logging for debugging
