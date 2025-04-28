import { Protobuf } from "as-proto/assembly";
import { Events as protoEvents } from "./pb/starknet/v1/Events";
import { Upgraded, UserRegistered } from "../generated/schema";
import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { JSON } from "assemblyscript-json";

// Helper function to generate a unique ID from transaction hash and event index
function generateEventId(txHash: Bytes, eventIndex: number): Bytes {
  const idStr = txHash.toHexString() + "-" + eventIndex.toString();
  return Bytes.fromUTF8(idStr);
}

// Helper functions to parse JSON safely
function getJSONStr(jsonValue: JSON.Value, key: string): string | null {
  if (!(jsonValue instanceof JSON.Obj)) return null;
  const jsonObj = jsonValue as JSON.Obj;
  const value = jsonObj.get(key);
  if (!value) return null;
  return value.stringify();
}

function getJSONBigInt(jsonValue: JSON.Value, key: string): BigInt | null {
  const str = getJSONStr(jsonValue, key);
  return str ? BigInt.fromString(str) : null;
}

function getJSONBytes(jsonValue: JSON.Value, key: string): Bytes | null {
  const str = getJSONStr(jsonValue, key);
  return str ? Bytes.fromHexString(str) : null;
}

export function handleTriggers(bytes: Uint8Array): void {
  const input = Protobuf.decode<protoEvents>(bytes, protoEvents.decode);
  const events = input.events;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const jsonStr = event.jsonDescription;

    // Check for empty JSON string
    if (!jsonStr || jsonStr === "") {
      log.warning("Empty JSON string at index {}", [i.toString()]);
      continue;
    }

    // Parse JSON description
    let jsonValue = JSON.parse(jsonStr);
    
    // Check if parsing was successful
    if (!(jsonValue instanceof JSON.Obj)) {
      log.warning("Failed to parse JSON or result is not an object at index {}: {}", [i.toString(), jsonStr]);
      continue;
    }

    // Extract common fields
    const eventType = getJSONStr(jsonValue, "eventType");
    const blockTimestamp = getJSONBigInt(jsonValue, "block_timestamp");
    const blockNumber = getJSONBigInt(jsonValue, "block_number");
    const transactionHash = getJSONBytes(jsonValue, "transaction_hash");

    if (!eventType || !blockTimestamp || !blockNumber || !transactionHash) {
      log.warning("Missing required fields in event at index {}: {}", [i.toString(), jsonStr]);
      continue;
    }

    // Generate unique ID
    const id = generateEventId(transactionHash, i);

    // Handle specific event types
    if (eventType == "Upgraded") {
      const implementation = getJSONStr(jsonValue, "implementation");

      if (!implementation) {
        log.warning("Missing Upgraded fields at index {}: {}", [i.toString(), jsonStr]);
        continue;
      }

      let entity = new Upgraded(id);
      entity.implementation = implementation ? implementation : "";
      entity.blockTimestamp = blockTimestamp ? blockTimestamp : BigInt.fromI32(0);
      entity.blockNumber = blockNumber ? blockNumber : BigInt.fromI32(0);
      entity.transactionHash = transactionHash ? transactionHash : Bytes.fromHexString("");
      entity.save();
    } else if (eventType == "UserRegistered") {
      const userId = getJSONBigInt(jsonValue, "user_id");
      const user = getJSONStr(jsonValue, "user");
      const userEventType = getJSONStr(jsonValue, "event_type");

      if (!userId || !user || !userEventType) {
        log.warning("Missing UserRegistered fields at index {}: {}", [i.toString(), jsonStr]);
        continue;
      }

      // Validate userEventType
      if (userEventType != "Register") {
        log.warning("Invalid userEventType {} at index {}: {}", [
          userEventType ? userEventType : "", 
          i.toString(), 
          jsonStr
        ]);
        continue;
      }

      let entity = new UserRegistered(id);
      entity.userId = userId ? userId : BigInt.fromI32(0);
      entity.user = user ? user : "";
      entity.eventType = userEventType ? userEventType : "Register";
      entity.blockTimestamp = blockTimestamp ? blockTimestamp : BigInt.fromI32(0);
      entity.blockNumber = blockNumber ? blockNumber : BigInt.fromI32(0);
      entity.transactionHash = transactionHash ? transactionHash : Bytes.fromHexString("");
      entity.save();
    }
  }
}