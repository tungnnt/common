import { AbstractConnector } from '@web3-react/abstract-connector';
import { ConnectorUpdate } from '@web3-react/types';
import Web3ProviderEngine from 'web3-provider-engine';
import CacheSubprovider from 'web3-provider-engine/subproviders/cache.js';

import { TrezorSubprovider } from './trezorSubprovider'; // https://github.com/0xProject/0x-monorepo/issues/1400
import { RPCSubprovider } from '@0x/subproviders/lib/src/subproviders/rpc_subprovider';

interface TrezorConnectorArguments {
  chainId: number;
  url: string;
  pollingInterval?: number;
  requestTimeoutMs?: number;
  config?: any;
  manifestEmail: string;
  manifestAppUrl: string;
}

export class TrezorConnector extends AbstractConnector {
  private readonly chainId: number;
  private readonly url: string;
  private readonly pollingInterval?: number;
  private readonly requestTimeoutMs?: number;
  private readonly config: any;
  private readonly manifestEmail: string;
  private readonly manifestAppUrl: string;

  private provider!: Web3ProviderEngine;

  constructor({
    chainId,
    url,
    pollingInterval,
    requestTimeoutMs,
    config = {},
    manifestEmail,
    manifestAppUrl,
  }: TrezorConnectorArguments) {
    super({ supportedChainIds: [chainId] });

    this.chainId = chainId;
    this.url = url;
    this.pollingInterval = pollingInterval;
    this.requestTimeoutMs = requestTimeoutMs;
    this.config = config;
    this.manifestEmail = manifestEmail;
    this.manifestAppUrl = manifestAppUrl;
  }

  public async activate(): Promise<ConnectorUpdate> {
    if (!this.provider) {
      const { default: TrezorConnect } = await import('trezor-connect');
      TrezorConnect.manifest({
        email: this.manifestEmail,
        appUrl: this.manifestAppUrl,
      });
      const engine = new Web3ProviderEngine({ pollingInterval: this.pollingInterval });
      engine.addProvider(
        new TrezorSubprovider({ trezorConnectClientApi: TrezorConnect, ...this.config }),
      );
      engine.addProvider(new CacheSubprovider());
      engine.addProvider(new RPCSubprovider(this.url, this.requestTimeoutMs));
      this.provider = engine;
    }

    this.provider.start();

    return { provider: this.provider, chainId: this.chainId };
  }

  public async getProvider(): Promise<Web3ProviderEngine> {
    return this.provider;
  }

  public async getChainId(): Promise<number> {
    return this.chainId;
  }

  public async getAccount(): Promise<string> {
    return ((this.provider as any)._providers[0] as TrezorSubprovider)
      .getAccountsAsync(1)
      .then((accounts: string[]): string => accounts[0]);
  }

  public async getAccounts(accountsLength: number): Promise<string[]> {
    return ((this.provider as any)._providers[0] as TrezorSubprovider).getAccountsAsync(
      accountsLength,
    );
  }

  public deactivate(): void {
    this.provider.stop();
  }
}
