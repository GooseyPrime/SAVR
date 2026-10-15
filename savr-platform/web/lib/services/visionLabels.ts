import type vision from '@google-cloud/vision';

type ImageAnnotatorClient = InstanceType<typeof vision.ImageAnnotatorClient>;

/** The only client capability label extraction needs; lets callers pass a stub. */
export type LabelDetectionClient = Pick<ImageAnnotatorClient, 'labelDetection'>;

export interface VisionLabel {
  description: string;
  /** Confidence in [0, 1], or null when Vision omitted it. */
  score: number | null;
}

/**
 * Runs Google Vision label detection for one image and normalizes the result.
 *
 * Vision 6 types every proto field as optional and nullable, so labels without
 * a description are dropped and missing scores become null instead of leaking
 * "undefined" into downstream prompts.
 */
export async function detectImageLabels(
  client: LabelDetectionClient,
  imageUrl: string
): Promise<VisionLabel[]> {
  const [result] = await client.labelDetection(imageUrl);
  const annotations = result?.labelAnnotations ?? [];

  return annotations.flatMap((annotation) => {
    const description = annotation.description?.trim();
    if (!description) return [];
    const score = typeof annotation.score === 'number' ? annotation.score : null;
    return [{ description, score }];
  });
}

/** Renders labels in the "name (confidence: score)" form the ingredient prompt expects. */
export function formatVisionLabels(labels: VisionLabel[]): string {
  return labels
    .map(({ description, score }) => `${description} (confidence: ${score ?? 'unknown'})`)
    .join(', ');
}
