import {
  PoolCreated as PoolCreatedEvent,
  Swap as SwapEvent
} from '../generated/UniswapFactory/UniswapFactory';
import { Pool, Token, Swap, Transaction } from '../generated/schema';
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';

export function handlePoolCreated(event: PoolCreatedEvent): void {
  let pool = new Pool(event.params.pool.toHex());
  pool.token0 = event.params.token0.toHex();
  pool.token1 = event.params.token1.toHex();
  pool.feeTier = event.params.fee.toI32();
  pool.liquidity = BigInt.fromI32(0);
  pool.volumeUSD = BigDecimal.fromString("0");
  pool.totalValueLockedUSD = BigDecimal.fromString("0");
  pool.save();

  // Update token's whitelistPools
  let token0 = Token.load(event.params.token0.toHex());
  let token1 = Token.load(event.params.token1.toHex());

  if (token0 != null) {
    let whitelistPools = token0.whitelistPools;
    whitelistPools.push(pool.id);
    token0.whitelistPools = whitelistPools;
    token0.save();
  }

  if (token1 != null) {
    let whitelistPools = token1.whitelistPools;
    whitelistPools.push(pool.id);
    token1.whitelistPools = whitelistPools;
    token1.save();
  }
}

export function handleSwap(event: SwapEvent): void {
  let transaction = Transaction.load(event.transaction.hash.toHex());

  if (transaction == null) {
    transaction = new Transaction(event.transaction.hash.toHex());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.swaps = [];
    transaction.save();
  }

  let pool = Pool.load(event.address.toHex());

  if (pool != null) {
    let swap = new Swap(
      event.transaction.hash
        .toHex()
        .concat("-")
        .concat(BigInt.fromI32(event.logIndex.toI32()).toString())
    );
    swap.transaction = transaction.id;
    swap.timestamp = event.block.timestamp;
    swap.pool = pool.id;
    swap.sender = event.params.sender;
    swap.recipient = event.params.recipient;
    swap.amountUSD = event.params.amountUSD; // Assume `amountUSD` is available in the event
    swap.save();

    let swaps = transaction.swaps;
    swaps.push(swap.id);
    transaction.swaps = swaps;
    transaction.save();

    // Update pool's stats
    pool.volumeUSD = pool.volumeUSD.plus(swap.amountUSD);
    pool.save();
  }
}
