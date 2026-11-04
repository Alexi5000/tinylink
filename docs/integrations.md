# Integration feasibility

| Provider  | Evidence                                                                                                                                                              | Current product status                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Firecrawl | An external development-tool request successfully retrieved Figma's page title, description, canonical and Open Graph metadata. The response was cached by Firecrawl. | No hosted runtime connection, credentials or enrichment path is configured. |
| Apify     | No usable Apify connector was available during the feasibility check. No actor or dataset was invoked.                                                                | No hosted runtime connection or import path is configured.                  |

The Firecrawl retrieval demonstrated that the external tool could return useful page metadata. It did not test the deployed application's ability to call Firecrawl, establish freshness, or populate the product. No retrieved content was inserted into the application database or source. The Connections view must continue to label both providers inactive.

## Smallest useful future slices

**Firecrawl: optional destination metadata.** After a link is created, an explicitly requested enrichment could suggest its title and description. The destination URL and ownership must be validated before a provider request. Provider timeouts, quota errors or unavailable consent must leave shortening and redirects working. Show the retrieval time and allow the user to retain their own title.

**Apify: selected dataset import.** A user could choose a specific actor result or dataset, map its URL/title fields, preview the rows and confirm import. Validate each row, cap batch size, report duplicates and failures, and apply the same owner and quota rules as single-link creation.

Both slices require a supported runtime connector, credentials or consent managed by that integration, clear cost limits, and tests for provider failure. Do not collect provider keys in the browser or advertise either feature as connected before a deployed request has been verified.
