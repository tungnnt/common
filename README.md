# Oasis common

A monorepo where we put the packages that are shared between different oasis apps.

## Contents

- [@oasis/connectors](packages/connectors) - web3-react connectors for Ledger, trezor and magic link
- [@oasis/transactions](packages/transactions) - Utilities for sending and monitoring transactions

## Building

`yarn build`

Will build all the packages in the correct order

```yarn watch```

Will continuosly build all the packages in watch mode

```yarn lint```

Linting

## Adding a new package

* Copy an existing small package
* Remove the code and add new code
* Adjust `README`, `package.json` and other files
* Append the new package to the top level `tsconfig.json` so that it gets built
* Adjust project references for dependants
* Add dependies from this repo as project references in the `tsconfig.json`

## Publishing

You need to be a member of @oasis npmjs org.