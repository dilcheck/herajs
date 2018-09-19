import Accounts from '../accounts';
import rpcTypes from './types.js';
import { fromHexString, toHexString, fromNumber, errorMessageForCode } from '../utils.js';
import promisify from '../promisify.js';
import { transactionToTx, txToTransaction } from '../transactions/utils.js';
import { decodeAddress } from '../accounts/utils.js';


const CommitStatus = rpcTypes.CommitStatus;
export { CommitStatus };

class AergoClient {
    constructor (config, provider = null) {
        this.version = 0.1;
        this.config = {
            ...config
        };
        this.client = provider || this.initProvider();
        this.accounts = new Accounts(this);
    }

    initProvider() {
        // Platform-specific override, see ../platforms/**
        // for auto-configuration of a provider.
        // Can also manually pass provider to constructor.
    }

    getConfig () {
        return this.config;
    }

    isConnected () {
        return false;
    }

    blockchain () {
        const empty = new rpcTypes.Empty();
        return promisify(this.client.blockchain, this.client)(empty).then(result => ({
            ...result.toObject(),
            bestBlockHash: toHexString(result.getBestBlockHash_asU8())
        }));
    }

    // Get transaction information in the aergo node. 
    // if transaction is in the block return result with block hash and index.
    getTransaction (txhash) {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(txhash);
        return new Promise((resolve, reject) => {
            this.client.getBlockTX(singleBytes, (err, result) => {
                if (err) {
                    this.client.getTX(singleBytes, (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            const res = {};
                            res.tx = txToTransaction(result);
                            resolve(res);
                        }
                    });
                } else {
                    const res = {};
                    res.block = result.getTxidx();
                    res.tx = txToTransaction(result.getTx());
                    resolve(res);
                }
            });
        });
    }

    getBlock (hashOrNumber) {
        if (typeof hashOrNumber === 'string') {
            hashOrNumber = fromHexString(hashOrNumber);
            if (hashOrNumber.length != 32) {
                throw new Error('Invalid block hash. Must be 32 byte encoded in hex. Did you mean to pass a block number?');
            }
        } else
        if (typeof hashOrNumber === 'number') {
            hashOrNumber = fromNumber(hashOrNumber);
        }
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(hashOrNumber);
        return promisify(this.client.getBlock, this.client)(singleBytes).then(result => {
            const obj = result.toObject();
            obj.hash = toHexString(result.getHash_asU8());
            obj.header.prevblockhash = toHexString(result.getHeader().getPrevblockhash_asU8());
            return obj;
        });
    }

    getState (address) {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(decodeAddress(address));
        return promisify(this.client.getState, this.client)(singleBytes);
    }
    
    getNonce(address) {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(decodeAddress(address));
        return promisify(this.client.getState, this.client)(singleBytes).then(state => state.getNonce());
    }

    verifyTransaction (tx) {
        return promisify(this.client.verifyTX, this.client)(transactionToTx(tx));
    }

    sendSignedTransaction (tx) {
        return new Promise((resolve, reject) => {
            const txs = new rpcTypes.TxList();
            txs.addTxs(transactionToTx(tx), 0);
            this.client.commitTX(txs, (err, result) => {
                if (err == null && result.getResultsList()[0].getError()) {
                    err = new Error();
                    err.code = result.getResultsList()[0].getError(); 
                    err.message = errorMessageForCode(err.code);
                }
                if (err) {
                    reject(err);
                } else {
                    resolve(result.getResultsList()[0].getHash_asB64());
                }
            });
        });
    }

    getTransactionReceipt (hash, callback) { // eslint-disable-line
        return true;
    }
}

export default AergoClient;