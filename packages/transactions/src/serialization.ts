import BigNumber from 'bignumber.js';
import { TxMeta, TxState, TxStatus } from './types';

// By default - toJSON method returns a string and we override it with our implementation that
// returns other type so we need to ignore the error
// eslint-disable-next-line
// @ts-ignore
BigNumber.prototype.toJSON = function toJSON() {
  return {
    _type: 'BigNumber',
    _data: Object.assign({}, this),
  };
};

function reviveFromJSON(_key: string, value: any) {
  if (typeof value === 'object' && value !== null && value.hasOwnProperty('_type')) {
    switch (value._type) {
      case 'BigNumber':
        return Object.assign(new BigNumber(0), value._data);
    }
  }
  const reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;
  if (reISO.exec(value)) return new Date(value);
  return value;
}

export function deserializeTransactions<A extends TxMeta>(
  serializedTransactions: string,
): TxState<A>[] {
  return JSON.parse(serializedTransactions, reviveFromJSON);
}

export function serializeTransactions<A extends TxMeta>(transactions: TxState<A>[]): string {
  console.log('serialize', transactions);
  return JSON.stringify(
    transactions.filter(
      (tx) =>
        tx.status !== TxStatus.CancelledByTheUser && tx.status !== TxStatus.WaitingForApproval,
    ),
  );
}
