import assert from 'node:assert/strict';
import test from 'node:test';

import vision from '@google-cloud/vision';

import {
  detectImageLabels,
  formatVisionLabels,
  type LabelDetectionClient,
} from '../lib/services/visionLabels';

const IMAGE_URL = 'https://example.test/pantry.jpg';

type BatchRequest = {
  requests?: Array<{ image?: { source?: { imageUri?: string } }; features?: Array<{ type?: unknown }> }>;
};

/**
 * Builds a real Vision client whose network-facing pieces are replaced, so the
 * library's own labelDetection helper (request shaping, feature selection,
 * promisification) runs exactly as in production without credentials or
 * billable API calls.
 */
function offlineClient(outcome: { labelAnnotations: unknown[] } | { error: Error }) {
  const client = new vision.ImageAnnotatorClient();
  const sent: BatchRequest[] = [];
  const stubbed = client as unknown as Record<string, unknown>;

  stubbed.initialize = () => {
    throw new Error('Vision client tried to initialize a network transport in a unit test');
  };
  // The library's annotateImage helper calls the GAPIC method callback-style.
  stubbed.batchAnnotateImages = (
    request: BatchRequest,
    _options: unknown,
    callback: (err: Error | null, response?: unknown) => void
  ) => {
    sent.push(request);
    if ('error' in outcome) {
      callback(outcome.error);
      return;
    }
    callback(null, { responses: [{ labelAnnotations: outcome.labelAnnotations }] });
  };

  return { client, sent };
}

test('vision 6 exposes ImageAnnotatorClient with the labelDetection helper on the default export', () => {
  assert.equal(typeof vision.ImageAnnotatorClient, 'function');
  assert.equal(typeof vision.ImageAnnotatorClient.prototype.labelDetection, 'function');
});

test('labelDetection sends one LABEL_DETECTION request for the image URL', async () => {
  const { client, sent } = offlineClient({ labelAnnotations: [{ description: 'Milk', score: 0.91 }] });

  const labels = await detectImageLabels(client, IMAGE_URL);

  assert.deepEqual(labels, [{ description: 'Milk', score: 0.91 }]);
  assert.equal(sent.length, 1);
  const [request] = sent[0].requests ?? [];
  assert.equal(request?.image?.source?.imageUri, IMAGE_URL);
  assert.equal(request?.features?.length, 1);
  assert.ok(
    ['LABEL_DETECTION', 4].includes(request?.features?.[0]?.type as string | number),
    `unexpected feature type ${String(request?.features?.[0]?.type)}`
  );
});

test('labels without a description are dropped and missing scores become null', async () => {
  const { client } = offlineClient({
    labelAnnotations: [
      { description: 'Eggs', score: 0.8 },
      { description: null, score: 0.7 },
      { description: '   ', score: 0.6 },
      { description: 'Butter', score: null },
      { description: 'Cheese' },
    ],
  });

  const labels = await detectImageLabels(client, IMAGE_URL);

  assert.deepEqual(labels, [
    { description: 'Eggs', score: 0.8 },
    { description: 'Butter', score: null },
    { description: 'Cheese', score: null },
  ]);
});

test('an empty or missing labelAnnotations list yields no labels', async () => {
  const { client } = offlineClient({ labelAnnotations: [] });
  assert.deepEqual(await detectImageLabels(client, IMAGE_URL), []);

  const missing: LabelDetectionClient = {
    labelDetection: (async () => [{}]) as unknown as LabelDetectionClient['labelDetection'],
  };
  assert.deepEqual(await detectImageLabels(missing, IMAGE_URL), []);
});

test('provider errors propagate so the caller can surface or fall back explicitly', async () => {
  const { client } = offlineClient({ error: new Error('7 PERMISSION_DENIED: billing disabled') });

  await assert.rejects(detectImageLabels(client, IMAGE_URL), /PERMISSION_DENIED/);
});

test('formatVisionLabels keeps the prompt format and marks unknown confidence', () => {
  assert.equal(
    formatVisionLabels([
      { description: 'Milk', score: 0.91 },
      { description: 'Butter', score: null },
    ]),
    'Milk (confidence: 0.91), Butter (confidence: unknown)'
  );
  assert.equal(formatVisionLabels([]), '');
});
