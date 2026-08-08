const sendEventToAWS = jest.fn().mockResolvedValue({});

jest.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({ send: sendEventToAWS })),
  PutEventsCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

export function mockAwsEventBridgeSDK() {
  return sendEventToAWS;
}
