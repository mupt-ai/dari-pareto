# Releasing `@mupt-ai/dari-pareto`

Package releases are published from the public
[`mupt-ai/dari-pareto`](https://github.com/mupt-ai/dari-pareto) mirror, not from
the private monorepo. Before the first release, grant the `mupt-ai-mirror-bot`
GitHub App access to that repository and configure npm trusted publishing for
repository `mupt-ai/dari-pareto` and workflow `publish-npm.yml`.

1. Update the package version and merge the package changes into the monorepo
   `main` branch.
2. Publish a normal Dari Mono release. The monorepo's **Mirror public packages**
   workflow copies that release's `dari-pareto` subtree to the public mirror.
3. The mirror push runs **Publish npm package**. Confirm the mirror contains the
   expected commit and npm exposes the new version and both package exports.

For an out-of-band release, manually run **Mirror public packages** on monorepo
`main`. Re-running either workflow is safe because an already-published version
is skipped.

No long-lived npm token is used. npm versions are immutable.
