import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { EventV2Bridge } from "@/event-v2-bridge"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { BackgroundJob } from "@/background/job"
import { LocalSubagentIndicatorEvent } from "@opencode-ai/schema/local-subagent-indicator-event"
import { SessionID } from "@/session/schema"
import { Context, Effect, Layer } from "effect"

export class Service extends Context.Service<Service, {}>()("@opencode/LocalSubagentIndicator") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const flags = yield* RuntimeFlags.Service

    if (!flags.experimentalLocalSubagentIndicator) {
      yield* Effect.logDebug("[local-subagent-indicator] flag off; sidecar is no-op")
      return Service.of({})
    }

    yield* Effect.logInfo("[local-subagent-indicator] flag on; starting polling sidecar")

    const background = yield* BackgroundJob.Service
    const events = yield* EventV2Bridge.Service

    const counts = new Map<SessionID, number>()

    yield* Effect.forkScoped(
      Effect.gen(function* () {
        while (true) {
          const jobs = yield* background.list()
          const next = new Map<SessionID, number>()

          for (const job of jobs) {
            if (job.status !== "running") continue
            const parent = job.metadata?.parentSessionId
            if (typeof parent !== "string") continue
            const sessionID = SessionID.make(parent)
            next.set(sessionID, (next.get(sessionID) ?? 0) + 1)
          }

          let published = 0
          for (const [sessionID, count] of next) {
            if (count !== counts.get(sessionID)) {
              yield* events.publish(LocalSubagentIndicatorEvent.Update, {
                sessionID,
                info: { count },
              })
              published++
            }
          }

          for (const [sessionID, prev] of counts) {
            if (!next.has(sessionID)) {
              yield* events.publish(LocalSubagentIndicatorEvent.Update, {
                sessionID,
                info: { count: 0 },
              })
              published++
            }
          }

          if (published > 0) {
            yield* Effect.logDebug(
              `[local-subagent-indicator] tick: jobs=${jobs.length} running=${next.size} published=${published}`,
            )
          }

          counts.clear()
          for (const [k, v] of next) counts.set(k, v)

          yield* Effect.sleep("1 second")
        }
      }).pipe(Effect.forever),
    )

    return Service.of({})
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [BackgroundJob.node, EventV2Bridge.node, RuntimeFlags.node],
})

export * as LocalSubagentIndicator from "./subagent-indicator"
