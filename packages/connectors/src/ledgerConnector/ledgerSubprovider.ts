import { assert } from '@0x/assert';
import {
  LedgerEthereumClient,
  LedgerEthereumClientFactoryAsync,
  LedgerGetAddressResult,
  LedgerSubproviderConfigs,
  PartialTxParams,
} from '@0x/subproviders/lib/src/types';
import { addressUtils } from '@0x/utils';
import { Transaction } from 'ethereumjs-tx';
import { publicToAddress } from 'ethereumjs-util';
import { stripHexPrefix } from 'ethjs-util';
import HDKey from 'hdkey';
import { Lock } from 'semaphore-async-await';
import { Dictionary } from 'ts-essentials';

import { BaseWalletSubprovider } from '@0x/subproviders/lib/src/subproviders/base_wallet_subprovider';
import { LedgerSubproviderErrors, WalletSubproviderErrors } from '@0x/subproviders/lib/src/types';

const DEFAULT_BASE_DERIVATION_PATH = `44'/60'/0'`;
const ASK_FOR_ON_DEVICE_CONFIRMATION = false;
const DEFAULT_NUM_ADDRESSES_TO_FETCH = 5;

const ledgerLiveRegex = /^(44'\/(?:1|60|61)'\/)(\d+)('?)$/;

export type OnDisconnectCallback = () => void;

export class LedgerSubprovider extends BaseWalletSubprovider {
  private readonly _connectionLock = new Lock();
  private readonly _networkId: number;
  private _derivationPath: string;
  private readonly _ledgerEthereumClientFactoryAsync: LedgerEthereumClientFactoryAsync;
  private _ledgerClientIfExists?: LedgerEthereumClient;
  private readonly _shouldAlwaysAskForConfirmation: boolean;
  private chosenAddress?: string;
  private addressToPathMap: Dictionary<string> = {};
  private _onDisconnect: OnDisconnectCallback;

  constructor(config: LedgerSubproviderConfigs & { onDisconnect: OnDisconnectCallback }) {
    super();
    this._onDisconnect = config.onDisconnect;
    this._networkId = config.networkId;
    this._ledgerEthereumClientFactoryAsync = config.ledgerEthereumClientFactoryAsync;
    this._derivationPath = config.baseDerivationPath || DEFAULT_BASE_DERIVATION_PATH;
    this._shouldAlwaysAskForConfirmation =
      config.accountFetchingConfigs !== undefined &&
      config.accountFetchingConfigs.shouldAskForOnDeviceConfirmation !== undefined
        ? config.accountFetchingConfigs.shouldAskForOnDeviceConfirmation
        : ASK_FOR_ON_DEVICE_CONFIRMATION;
  }

  public async getAccountsAsync(
    accountsLength: number = DEFAULT_NUM_ADDRESSES_TO_FETCH,
  ): Promise<string[]> {
    this._ledgerClientIfExists = await this._createLedgerClientAsync();
    try {
      const eth = this._ledgerClientIfExists;
      const addresses = [];

      if (this._derivationPath.match(ledgerLiveRegex)) {
        for (let i = 0; i < accountsLength; i++) {
          const newPath =
            this._derivationPath.replace(
              ledgerLiveRegex,
              (_, g1: string, g2: string, g3: string) => g1 + String(parseInt(g2) + i) + g3,
            ) + '/0/0';
          const { address } = await eth.getAddress(
            newPath,
            this._shouldAlwaysAskForConfirmation,
            true,
          );
          addresses.push(address);
          this.addressToPathMap[address.toLowerCase()] = newPath;
        }
      } else {
        const pathComponents = LedgerSubprovider.obtainPathComponentsFromDerivationPath(
          this._derivationPath,
        );
        const addressGenerator = new AddressGenerator(
          await eth.getAddress(pathComponents.basePath, this._shouldAlwaysAskForConfirmation, true),
        );
        for (let i = 0; i < accountsLength; i++) {
          const path = pathComponents.basePath + (pathComponents.index + i).toString();
          const address = addressGenerator.getAddressString(i);
          addresses.push(address);
          this.addressToPathMap[address.toLowerCase()] = path;
        }
      }

      return addresses;
    } finally {
      await this._destroyLedgerClientAsync();
    }
  }

  private static obtainPathComponentsFromDerivationPath(
    derivationPath: string,
  ): { basePath: string; index: number } {
    // check if derivation path follows 44'/60'/x'/n pattern
    const regExp = /^(44'\/(?:1|60|61)'\/\d+'?\/(?:\d+'?\/)?)(\d+)$/;
    const matchResult = regExp.exec(derivationPath);
    if (matchResult === null) {
      throw new Error('invalid derivation path');
    }
    return { basePath: matchResult[1], index: parseInt(matchResult[2], 10) };
  }

  public async signTransactionAsync(txParams: PartialTxParams): Promise<string> {
    LedgerSubprovider._validateTxParams(txParams);
    if (txParams.from === undefined || !addressUtils.isAddress(txParams.from)) {
      throw new Error(WalletSubproviderErrors.FromAddressMissingOrInvalid);
    }

    if (this.chosenAddress) {
      txParams.from = this.chosenAddress;
    }
    const path = this.addressToPathMap[txParams.from.toLowerCase()];
    if (!path) throw new Error(`address unknown '${txParams.from}'`);

    this._ledgerClientIfExists = await this._createLedgerClientAsync();

    const tx = new Transaction(txParams, { chain: this._networkId });

    // Set the EIP155 bits
    const vIndex = 6;
    tx.raw[vIndex] = Buffer.from([this._networkId]); // v
    const rIndex = 7;
    tx.raw[rIndex] = Buffer.from([]); // r
    const sIndex = 8;
    tx.raw[sIndex] = Buffer.from([]); // s

    const txHex = tx.serialize().toString('hex');
    try {
      const result = await this._ledgerClientIfExists.signTransaction(path, txHex);
      // Store signature in transaction
      tx.r = Buffer.from(result.r, 'hex');
      tx.s = Buffer.from(result.s, 'hex');
      tx.v = Buffer.from(result.v, 'hex');

      // EIP155: v should be chain_id * 2 + {35, 36}
      const eip55Constant = 35;
      const signedChainId = Math.floor((tx.v[0] - eip55Constant) / 2);
      if (signedChainId !== this._networkId) {
        await this._destroyLedgerClientAsync();
        const err = new Error(LedgerSubproviderErrors.TooOldLedgerFirmware);
        throw err;
      }

      const signedTxHex = `0x${tx.serialize().toString('hex')}`;
      await this._destroyLedgerClientAsync();
      return signedTxHex;
    } catch (err) {
      await this._destroyLedgerClientAsync();
      throw err;
    }
  }

  public async signPersonalMessageAsync(data: string, address: string): Promise<string> {
    if (data === undefined) {
      throw new Error(WalletSubproviderErrors.DataMissingForSignPersonalMessage);
    }
    assert.isHexString('data', data);
    assert.isETHAddressHex('address', address);

    const path = this.addressToPathMap[address.toLowerCase()];
    if (!path) throw new Error(`address unknown '${address}'`);

    this._ledgerClientIfExists = await this._createLedgerClientAsync();
    try {
      const result = await this._ledgerClientIfExists.signPersonalMessage(
        path,
        stripHexPrefix(data),
      );
      const lowestValidV = 27;
      const v = result.v - lowestValidV;
      const hexBase = 16;
      let vHex = v.toString(hexBase);
      if (vHex.length < 2) {
        vHex = `0${v}`;
      }
      const signature = `0x${result.r}${result.s}${vHex}`;
      await this._destroyLedgerClientAsync();
      return signature;
    } catch (err) {
      await this._destroyLedgerClientAsync();
      throw err;
    }
  }

  // tslint:disable-next-line:prefer-function-over-method
  public async signTypedDataAsync(_address: string, _typedData: never): Promise<string> {
    throw new Error(WalletSubproviderErrors.MethodNotSupported);
  }
  private async _createLedgerClientAsync(): Promise<LedgerEthereumClient> {
    await this._connectionLock.acquire();
    if (this._ledgerClientIfExists !== undefined) {
      this._connectionLock.release();
      throw new Error(LedgerSubproviderErrors.MultipleOpenConnectionsDisallowed);
    }
    const ledgerEthereumClient = await this._ledgerEthereumClientFactoryAsync();

    (ledgerEthereumClient.transport as any).on('disconnect', this._onDisconnect?.bind(this));
    this._connectionLock.release();
    return ledgerEthereumClient;
  }

  private async _destroyLedgerClientAsync(): Promise<void> {
    await this._connectionLock.acquire();
    if (this._ledgerClientIfExists === undefined) {
      this._connectionLock.release();
      return;
    }
    await this._ledgerClientIfExists.transport.close();
    this._ledgerClientIfExists = undefined;
    this._connectionLock.release();
  }
}

class AddressGenerator {
  private hdk: HDKey;

  constructor(data: LedgerGetAddressResult) {
    this.hdk = new HDKey();
    this.hdk.publicKey = Buffer.from(data.publicKey, 'hex');
    this.hdk.chainCode = Buffer.from(data.chainCode, 'hex');
  }

  getAddressString = (index: number) => {
    const derivedKey = this.hdk.derive(`m/${index}`);
    const address = publicToAddress(derivedKey.publicKey, true);
    const addressString = '0x' + address.toString('hex');
    return addressString;
  };
}
