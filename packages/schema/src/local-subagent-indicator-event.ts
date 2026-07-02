export * as LocalSubagentIndicatorEvent from "./local-subagent-indicator-event"

import { Schema } from "effect"
import { Event } from "./event"
import { NonNegativeInt } from "./schema"
import { SessionID } from "./session-id"

export const Info = Schema.Struct({
  count: NonNegativeInt,
})

export const Update = Event.define({
  type: "local.subagent.indicator",
  schema: {
    sessionID: SessionID,
    info: Info,
  },
})

export const Definitions = Event.inventory(Update)
