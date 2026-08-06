import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eventBridgeClient = new EventBridgeClient({});

export async function publish(
  detailType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "helpdesk",
          DetailType: detailType,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );
}
