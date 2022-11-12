# Netlify Production Branch

Wait for a Netlify deploy to be ready.

## Inputs

### `netlifyToken`

_Required._ Netlify personal API token.

### `siteId`

_Required._ Netlify site ID.

### `branch`

_Required._ Deployed branch.

## Example usage

```yaml
uses: perdoo/netlify-wait-for-deploy@main
with:
  netlifyToken: ${{ secrets.NETLIFY_AUTH_TOKEN }}
  siteId: foo
  branch: mybranch
```
