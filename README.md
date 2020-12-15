# Oasis common

A monorepo where we put the packages that are shared between different oasis apps.

## Contents

- [@oasis/connectors](packages/connectors) - web3-react connectors for Ledger, trezor and magic link
- [@oasis/transactions](packages/transactions) - Utilities for sending and monitoring transactions
- [@oasis/web3-context](packages/web3-context) - Web3Context
- [@oasis/utils](packages/utils) - The rest of the utilities

## How to start developing

- Clone the repo
- Run `yarn`
- Run `yarn build` or `yarn watch`
- You can also run the linter by running `yarn lint`

## How to use new versions without publishing

There are two main approaches to using local packages in other local packages.

1. Use `yarn link` in the dependency and `yarn link package` in the dependee. It will create
   symlinks to a dependency folder from a dependee folder. Unfortunately it does not work with
   nextjs/webpack as it can not find dependencies of linked packages.
2. Use [`yalc`](https://www.npmjs.com/package/yalc). This is the one we go with.

Yalc allows you to publish the package to the local store and pull if from there into a dependee. It
also tracks those links and in case you have `A => B` and `C => B` - you can run `yalc push` from
`B` and `B` will be updated in both `A` and `C`.

There is a npm script `yarn yalc:push:all` that will call `yalc push` in all packages. After that -
you can go to your dependee and call `yalc add @oasisdex/${name}`.

Now your dependee will use the local version of `@oasisdex/${name}`. You can either execute
`yalc push` or `yarn yalc:push:all` manually after every change or use the `yarn watch:push` script.
It will run the ts compiler in watch project mode and on each compilation (successful or failed) run
`yarn yalc:push:all` for you.

Now the `node_modules` of the dependees will be updated on change, but `webpack` and `next.js` will
still not be able to pick up the changes. For that -
[see this answer](https://stackoverflow.com/a/59954986/3546986)

After you've configured webpack - you should be able to make a change, click save and let the magic
happen:

- `TS` recompiles the changes and dependees in common
- `tsc-watch` sees that and calls `yalc`
- `yalc` publishes changes to the yalc store and to all the dependees that depend on those packages
- Dependees `webpacks` pick up the changes in node_modules and rebuild/hot-reload
- Changes are visible on the page

If you want to read more about `yalc` see
(here)[https://www.viget.com/articles/how-to-use-local-unpublished-node-packages-as-project-dependencies/].

## Adding a new package

- Copy an existing small package
- Remove the code and add new code
- Adjust `README`, `package.json` and other files
- Append the new package to the top level `tsconfig.json` so that it gets built
- Adjust project references for dependants
- Add dependies from this repo as project references in the `tsconfig.json`

## Publishing

- You need to be a member of `@oasisdex` npmjs org.
- Login into npm by running `npm login`
- Run `yarn run:publish`. It will build the project and run `lerna publish`
- Lerna will publish the packages that have changed and ask you for new versions (patch, minor,
  major)
