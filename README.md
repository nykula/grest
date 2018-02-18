# gjs-status

Counts issues and merge requests for Gjs, with Gjs.

## Usage

Get a [GitLab token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) and run:

```bash
# Ubuntu 17.10
sudo apt update && sudo apt install gir1.2-glib-2.0 gir1.2-soup-2.4 git gjs npm

git clone https://github.com/makepost/gjs-status
cd gjs-status

GITLAB_TOKEN=... PORT=3000 yarn start
```

## Development

Also install [Yarn](https://yarnpkg.com/en/docs/install#linux-tab). Get started:

```bash
# install development dependencies
yarn

# lint all JS files
yarn format
```

[VS Code](https://code.visualstudio.com/) will highlight mistakes and provide autocomplete, as long as you follow JSDoc [@param](http://usejsdoc.org/tags-param.html) and [@type](http://usejsdoc.org/tags-type.html).

## License

MIT
