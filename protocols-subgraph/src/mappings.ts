import { Protobuf } from "as-proto/assembly";
import { Events as protoEvents } from "./pb/starknet/v1/Events";
import {
  ProtocolCampaign,
  JoinProtocolCampaign,
  DeployProtocolNft,
  ProtocolRegistered,
} from "../generated/schema";
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

    // Parse JSON description
    let jsonValue: JSON.Value;
    if (!jsonStr || jsonStr === "") {
      log.warning("Empty JSON string at index {}", [i.toString()]);
      continue;
    }
    jsonValue = JSON.parse(jsonStr);

    if (!(jsonValue instanceof JSON.Obj)) {
      log.warning("JSON is not an object for event at index {}: {}", [i.toString(), jsonStr]);
      continue;
    }

    // Extract common fields
    const eventType = getJSONStr(jsonValue, "eventType");
    const protocolId = getJSONBigInt(jsonValue, "protocol_id");
    const blockTimestamp = getJSONBigInt(jsonValue, "block_timestamp");
    const blockNumber = getJSONBigInt(jsonValue, "block_number");
    const transactionHash = getJSONBytes(jsonValue, "transaction_hash");

    if (!eventType || !protocolId || !blockTimestamp || !blockNumber || !transactionHash) {
      log.warning("Missing required fields in event at index {}: {}", [i.toString(), jsonStr]);
      continue;
    }

    // Generate unique ID
    const id = generateEventId(transactionHash, i);

    // Handle specific event types
    if (eventType == "ProtocolCampaign") {
      const protocolOwner = getJSONStr(jsonValue, "protocol_owner");
      const protocolNftAddress = getJSONStr(jsonValue, "protocol_nft_address");

      if (!protocolOwner || !protocolNftAddress) {
        log.warning("Missing ProtocolCampaign fields at index {}: {}", [i.toString(), jsonStr]);
        continue;
      }

      let entity = new ProtocolCampaign(id);
      entity.protocolId = protocolId ? protocolId : BigInt.fromI32(0);
      entity.protocolOwner = protocolOwner ? protocolOwner : "";
      entity.protocolNftAddress = protocolNftAddress ? protocolNftAddress : "";
      entity.blockTimestamp = blockTimestamp ? blockTimestamp : BigInt.fromI32(0);
      entity.blockNumber = blockNumber ? blockNumber : BigInt.fromI32(0);
      entity.transactionHash = transactionHash ? transactionHash : Bytes.fromHexString("");
      entity.save();
    } else if (eventType == "JoinProtocolCampaign") {
      const caller = getJSONStr(jsonValue, "caller");
      const tokenId = getJSONBigInt(jsonValue, "token_id");
      const user = getJSONStr(jsonValue, "user");

      if (!caller || !tokenId || !user) {
        log.warning("Missing JoinProtocolCampaign fields at index {}: {}", [i.toString(), jsonStr]);
        continue;
      }

      let entity = new JoinProtocolCampaign(id);
      entity.protocolId = protocolId ? protocolId : BigInt.fromI32(0);
      entity.caller = caller ? caller : "";
      entity.tokenId = tokenId ? tokenId : BigInt.fromI32(0);
      entity.user = user ? user : "";
      entity.blockTimestamp = blockTimestamp ? blockTimestamp : BigInt.fromI32(0);
      entity.blockNumber = blockNumber ? blockNumber : BigInt.fromI32(0);
      entity.transactionHash = transactionHash ? transactionHash : Bytes.fromHexString("");
      entity.save();
    } else if (eventType == "DeployProtocolNft") {
      const protocolNft = getJSONStr(jsonValue, "protocol_nft");

      if (!protocolNft) {
        log.warning("Missing DeployProtocolNft fields at index {}: {}", [i.toString(), jsonStr]);
        continue;
      }

      let entity = new DeployProtocolNft(id);
      entity.protocolId = protocolId ? protocolId : BigInt.fromI32(0);
      entity.protocolNft = protocolNft ? protocolNft : "";
      entity.blockTimestamp = blockTimestamp ? blockTimestamp : BigInt.fromI32(0);
      entity.blockNumber = blockNumber ? blockNumber : BigInt.fromI32(0);
      entity.transactionHash = transactionHash ? transactionHash : Bytes.fromHexString("");
      entity.save();
    } else if (eventType == "ProtocolRegistered") {
      const protocolOwner = getJSONStr(jsonValue, "protocol_owner");
      const userEventType = getJSONStr(jsonValue, "event_type");

      if (!protocolOwner || !userEventType) {
        log.warning("Missing ProtocolRegistered fields at index {}: {}", [i.toString(), jsonStr]);
        continue;
      }

      // Validate userEventType
      if (userEventType != "Register" && userEventType != "Verify") {
        log.warning("Invalid userEventType {} at index {}: {}", [userEventType ? userEventType : "", i.toString(), jsonStr]);
        continue;
      }

      let entity = new ProtocolRegistered(id);
      entity.protocolId = protocolId ? protocolId : BigInt.fromI32(0);
      entity.protocolOwner = protocolOwner ? protocolOwner : "";
      entity.eventType = userEventType ? userEventType : "Register";
      entity.blockTimestamp = blockTimestamp ? blockTimestamp : BigInt.fromI32(0);
      entity.blockNumber = blockNumber ? blockNumber : BigInt.fromI32(0);
      entity.transactionHash = transactionHash ? transactionHash : Bytes.fromHexString("");
      entity.save();
    }
  }
}