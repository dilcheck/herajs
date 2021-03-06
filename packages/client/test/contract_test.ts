import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
const assert = chai.assert;

import AergoClient from '../src';
//import AergoClient from '../dist/herajs.esm';

// @ts-ignore
import contractAbi from './fixtures/contract-inc.abi.json';
//import sqlContractAbi from './fixtures/contract-sql.abi.json';
import Contract from '../src/models/contract';
import { longPolling } from '../src/utils';

describe('Contracts', () => {
    const aergo = new AergoClient();

    describe('deploy, call, query a simple contract', () => {
        const contractCode = 'RT4ybGApGoUrNWoisFAAnc1K8gGGd8VCdbbnXBYgpRyd87CWuj3krKobcV7B8vyY15XbHobWEZBX1drFDTU62ufapcP9u1PmibQiXt1FY3YS3v5ZYuH1vuekEWBES4yoWzhJoPFLDCZWdmxYM2manPHLJwefSb6WnYrcmT3Cbpf9266E3eQjsEhbKrZ3CX5FuU8v4MQbsmFhhBfB5S57T3EnzfHTcbSLFwLgvH5DSxEBYoDh2hLcs7e5As6qHvbL8yAQMp7Tz9KH8METfb63ywvGbBPLYQfgdg2kC2DbKdtNroX8seVzznC5SCFPLU6aZAcQnuLuApfcBntEQwsvf5HpEFyJjqEZAhwDSHo3EP8hG1LuKANe5mqCEW9nEVsyV9mGnpAz1Y9eXcQbAgvyVfyvZETpb78h5hZuwNXi2UQh53SKBRyTnc5JS33dTZNR1SRitfX9rZHcowF6pK4a6iptdBwZTu4LcrRC64rqxB928pxYC7Ejh6pLgd7H1GP9v3FmD64Zhy2fEYKMS2jkFCFESYX4gP17Sm4xMw7H8fUDCwcGovTDSd4kkwq8p5HhMpVt9AZMzR7e5vpGJTa9XAve8LjxRbJH4y683Nt1NbEPQWnR9QuJUyQv5SUKi9t9R3rpNvAzmeLNXnmH8qifrZwmpuHhKvG6E7CZ4fe59aBLwabUAEZ8woJ1RXupqDAm69Y7pqZST6Fk5tT4PTspnWir15MiZAgDFKb59vAdUrJso6FLvDTmBWzZBp9MHaQ8DP5E11aEBLzvyas75pYT8ZBiLYbnYcSHfVwmavDGHPx7bp8xtt2vgw7pN';
        let contractAddress;
        let testAddress;
        let deployTxhash;

        it('should deploy a smart contract', async () => {
            testAddress = await aergo.accounts.create('test');
            await aergo.accounts.unlock(testAddress, 'test');

            // Deploy contract
            const contract = Contract.fromCode(contractCode);
            const testtx = {
                from: testAddress,
                to: null,
                payload: contract.asPayload([10]),
                chainIdHash: await aergo.getChainIdHash()
            };
            deployTxhash = await aergo.accounts.sendTransaction(testtx);
            assert.typeOf(deployTxhash, 'string');
            
            // Wait for deployment receipt
            const receipt = await longPolling(async () => 
                await aergo.getTransactionReceipt(deployTxhash)
                , result => result.hasOwnProperty('contractaddress'), 2000);
            assert.equal(receipt.status, 'CREATED');
            contractAddress = receipt.contractaddress;
        }).timeout(2100);

        it('should get a smart contract\'s ABI', async () => {
            const abi = await aergo.getABI(contractAddress);
            // getABI returns fields that are not currently in the ABI generated by aergoluac
            const abiFiltered = {
                ...abi,
                functions: abi.functions.map(func => ({
                    name: func.name,
                    arguments: func.arguments,
                })),
                state_variables: abi.state_variables.map(variable => ({
                    name: variable.name,
                    type: variable.type,
                }))
            }
            assert.deepEqual(abiFiltered, contractAbi);
        });

        it('should load ABI from smart contract', async () => {
            const contract = Contract.atAddress(contractAddress);
            contract.loadAbi(await aergo.getABI(contractAddress));
            // @ts-ignore
            assert.typeOf(contract.inc, 'function');
        });

        it('should call a smart contract', async () => {
            // Setup address and ABI
            const contract = Contract.fromAbi(contractAbi).setAddress(contractAddress);

            // Call contract
            // @ts-ignore
            const callTx = contract.inc().asTransaction({
                from: testAddress,
                chainIdHash: await aergo.getChainIdHash()
            });
            assert.equal(callTx.from, testAddress);
            const calltxhash = await aergo.accounts.sendTransaction(callTx);
            const calltxreceipt = await longPolling(async () => 
                await aergo.getTransactionReceipt(calltxhash)
            );
            assert.equal(calltxreceipt.status, 'SUCCESS');

            // Test missing from address
            assert.throws(() => {
                // @ts-ignore
                aergo.accounts.sendTransaction(contract.inc().asTransaction());
            }, Error, 'Missing required transaction parameter \'from\'. Call with asTransaction({from: ...})');
            assert.throws(() => {
                // @ts-ignore
                aergo.accounts.sendTransaction(contract.inc().asTransaction({
                    from: null,
                }));
            }, Error, 'Missing required transaction parameter \'from\'. Call with asTransaction({from: ...})');
        });

        it('should query a smart contract using Getter', async () => {
            // Setup address and ABI
            const contract = Contract.fromAbi(contractAbi).setAddress(contractAddress);

            // Query contract
            // @ts-ignore
            const result1 = await aergo.queryContract(contract.query('key1'));
            assert.equal(result1, 11);

            // Call contract again
            // @ts-ignore
            const callTx = contract.inc().asTransaction({
                from: testAddress,
                chainIdHash: await aergo.getChainIdHash()
            });
            const callTxHash = await aergo.accounts.sendTransaction(callTx);
            const callTxReceipt = await longPolling(async () =>
                await aergo.getTransactionReceipt(callTxHash)
            );
            assert.equal(callTxReceipt.status, 'SUCCESS');

            // Query contract
            // @ts-ignore
            const result2 = await aergo.queryContract(contract.query('key1'));
            assert.equal(result2, 12);
        }).timeout(3000);

        it('should query a smart contract using state', async () => {
            // Setup address and ABI
            const contract = Contract.fromAbi(contractAbi).setAddress(contractAddress);

            // Query contract state
            const result = await aergo.queryContractState(contract.queryState('_sv_Value'));
            assert.equal(result, 12);

            // TODO changed api!
        });

        it('should get events from a deployed contract', async () => {
            const result = await aergo.getEvents({
                address: contractAddress
            });
            assert.equal(result[0].eventName, 'incremented');
            assert.equal(result[0].address.toString(), contractAddress.toString());
            assert.equal(result[0].args[1], 12);
            assert.equal(result[1].args[1], 11);
            assert.equal(result[0].args[0], 11);
            assert.equal(result[1].args[0], 10);

            // test getting the same event by two different arguments
            const result2 = await aergo.getEvents({
                address: contractAddress,
                args: [10] // == new Map([[0, 10]])
            });
            assert.equal(result2.length, 1);
            assert.equal(result2[0].eventName, 'incremented');
            assert.equal(result2[0].address.toString(), contractAddress.toString());
            assert.equal(result2[0].args[0], 10);
            assert.equal(result2[0].args[1], 11);

            const result3 = await aergo.getEvents({
                address: contractAddress,
                args: new Map([[1, 11]])
            });
            assert.equal(result3.length, 1);
            assert.equal(result3[0].args[0], 10);
            assert.equal(result3[0].args[1], 11);
            assert.equal(result3[0].txhash, result2[0].txhash);
        });

        it('should stream events from a deployed contract', (done) => {
            let txhash;
            async function sendTx() {
                const contract = Contract.fromAbi(contractAbi).setAddress(contractAddress);
                // @ts-ignore
                const callTx = contract.inc().asTransaction({
                    from: testAddress,
                    chainIdHash: await aergo.getChainIdHash()
                });
                txhash = await aergo.accounts.sendTransaction(callTx);
            }
            const stream = aergo.getEventStream({
                address: contractAddress
            });
            stream.on('data', (event) => {
                assert.equal(event.eventName, 'incremented');
                assert.equal(event.txhash, txhash);
                stream.cancel();
                done();
            });
            sendTx();
        });
    });


    /*
    describe('deploy, call, query an sql contract', () => {
        const contractCode = 'L27gmNZNrxKAEqjXaPHsvxUsR9CnuahUKaVfawXxJvwoEr5idXcetQ3xyyB3pFiUpv29Fx9io8E4eaDQ44ibM7DLoVHHqWAajRMm6BVLzG4NJXEszmv3T8Ens6MAy2Se2j8Kz8H8LSMZtxwybRR876aveJJw4Ce3sGnY8v47xZsF44sS2yVYFRtAb6tDfhhKHgZWpJsrNuGxwLaJRL4fnb7hG2Eic4eV8Auf47L4poQCWb2u3S5HhN1XKHhZcFLt9x41DNn1zXunfmGSCYcTfrg6ccxBuKFYkL72bbknBpLoXDRyuzHsViBkoBKhGgrTtXj8ts1CqJV2Jm3sHvhtCL3azy776WWBXxtG8sLUC9KojV16BENhmCKynSFGKUznx1NXCZGMeq8q5MGrQLPCWjfSescNAK3NQtXTFQhr85FPBaM5fKgoqPE9cggDkFB8gHNS8GVXFMxWuSbjQo4Y27UQsR79w5H26b5LQ4LvoyLxh8MEVBJYywHqpUmhBsNvtESexAppK5Fc3Zv4Q4Fpf9gUrp2zX4SQyPsRefwWvJPBjy7fgsksokLULgJSTBhxpWZM1bC9zqLLBc74EJYQhrJ2Szp17VvVktbh3V7YcN6EJSt66G9UAZMt8sTbSAjLiedSjDBL3iJoYsgfPSeMYbS4TYtcADzoYRK6fJH2VyD9NMi51FVX6dFSUaSAP92vGmjekjwQu6MA3JtSSKRyMNM9d7ZCMRawoiHtX7ieQ1zHrt7d5nDSQgnXzQ6r1YFSZRScagweXDMseRmcCfbFDHKDd7D18GurwQxnu8utjTZufSDPxBXo3c5FszZ7K8aoaqRxPPGLrZjjJJSKCaxcoH1CFMcJpd7R4E2853KEpL7CfRUgSXesNGJ4MvrEyf96N3kcZhK3sUDxfhQkUvrS4Bzy1ZwwBezi69xAeApMU7XhD5hgLVqgr5MhA19or3q8P3Wbfg2Yc5DtCV9ko9CQqximaJfWAJ33kCHYgWod9XhoBTmkaoYDLP3Q363A9i9TXa297Z4j19CbipRUhZdcVWb5PHc2uKuPo9KzsdNsVKmBg1CkTJRX148iro1AcWzJmVRGZUkKynbhpZiyK7QTnKcVYZsXCvhEMzPDSebi2wNuaX5TvMkJjHuxx3e6FqYcAazWDS2kaoBx6y6y8QAyrzrFaQqJ51u9B1h5LFtcLRM4NvGakknV7YR7kGdiwvo8dFmKKZKhGotRm17XAnAmYhyTe1hkT5yF2VmVVGSBH8JxfXNC3LknwQ13vHt5PEdKUj7FfPtoiLAUE5a4GX3Kk2KZUn2aqBg4h7wjcjoa9kLHcy94nE5SNUZyNVN4WiwEGWSbYU3DbzAWpPTBnizisMZLB7zA1s1yYQXK4WqivLehF8YMLsqttHLwmwNsrTDpacxAPubaav2uiphMcPMUgNZa6u5SBQ1EL6MW41Mz97oP8sn9oTJdB5tsmofQqN7HZdaBfjp1tEU6CDEyEyrnqjPksmeKjbzwPK9PugAs5JC4H1VPyfAyodPBsBmQDVaLE5Y4jNQK4LUyMULSDXZ9iqpMraU5iooAn6hVp6esBnUvkZB71jTgS3ucNoYJxVBbSPysKBSH6wRRcoW79xM5DMXUXpVpev4A5KREF5Kt5MfCngd1soPFGvRihXWJWVSpdYh7P5EweUpWZb2SodX3S7r3SpF29JE9k8gtqNs8dqoxKDZY6VmdTzdR8d9Tr8i9AyeMoqJUSo8wmjfswfsvadFGT7gGRVNxKSRtBv';
        let contractAddress;
        let testAddress;
        let deployTxhash;

        it('should deploy a smart contract', async () => {
            testAddress = await aergo.accounts.create('test');
            await aergo.accounts.unlock(testAddress, 'test');

            // Deploy contract
            const contract = Contract.fromCode(contractCode);
            const testtx = {
                from: testAddress,
                to: null,
                amount: 0,
                payload: contract.asPayload(),
            };
            deployTxhash = await aergo.accounts.sendTransaction(testtx);
            assert.typeOf(deployTxhash, 'string');
            
            // Wait for deployment receipt
            const receipt = await longPolling(async () => 
                await aergo.getTransactionReceipt(deployTxhash)
            );
            assert.equal(receipt.status, 'CREATED');
            contractAddress = receipt.contractaddress;
        });

        
        it('should call and query', async () => {
            const contract = Contract.atAddress(contractAddress).loadAbi(sqlContractAbi);

            // Call contract
            const txHash = await aergo.accounts.sendTransaction(contract.insertTestValues().asTransaction({
                from: testAddress
            }));

            // Wait for receipt
            await longPolling(async () =>
                await aergo.getTransactionReceipt(txHash)
            );
            
            // Query contract
            const result = await aergo.queryContract(contract.query());
            assert.deepEqual(result, [
                [ 2, 3.1, 'X Hello Blockchain' ],
                [ 2, 3.1, 'Y Hello Blockchain' ],
                [ 2, 3.1, 'Z Hello Blockchain' ]
            ]);
        }).timeout(31000);

        it('should handle invalid calls', async () => {
            const contract = Contract.atAddress(contractAddress).loadAbi(sqlContractAbi);

            // Payload with undefined function
            let tx = contract.insertTestValues().asTransaction({
                from: testAddress
            });
            tx.payload = '{"Name":"undefinedFunction","Args":[]}';
            const txHash = await aergo.accounts.sendTransaction(tx);
            const result = await longPolling(async () =>
                await aergo.getTransactionReceipt(txHash)
            );
            assert.equal(result.status, 'undefined function: undefinedFunction');

            // Payload with invalid JSON
            tx = contract.insertTestValues().asTransaction({
                from: testAddress
            });
            tx.payload = '{"Name":"insertTestValues","Args":[]}invalidjson';
            const txHash2 = await aergo.accounts.sendTransaction(tx);
            const result2 = await longPolling(async () =>
                await aergo.getTransactionReceipt(txHash2)
            );
            assert.equal(result2.status, 'invalid character \'i\' after top-level value');

        }).timeout(31000);
       
        
    });
     */
});
