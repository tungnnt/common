# Oasis common

A monorepo where we put the packages that are shared between different oasis apps.

## Contents

- [@oasis/connectors](packages/connectors) - web3-react connectors for Ledger, trezor and magic link
- [@oasis/transactions](packages/transactions) - Utilities for sending and monitoring transactions

## How to start developing

- Clone the repo
- Run `yarn`
- Run `yarn build` or `yarn watch`
- If you want to try using new versions before publishing (which you should) - you can use
  `yarn link:all` and `yarn unlink:all` commands which will link all the packages and make them
  available to use by running `yarn link @oasisdex/${name}` in other projects
- You can also run the linter by running `yarn lint`

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
