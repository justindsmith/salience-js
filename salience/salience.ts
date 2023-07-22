import * as tf from "@tensorflow/tfjs-node";
import * as tensorflow from "@tensorflow-models/universal-sentence-encoder";

class TensorFlowEmbeddingGenerator {
  private sentenceEncoder: tensorflow.UniversalSentenceEncoder | undefined;

  async load() {
    if (!this.sentenceEncoder) {
      this.sentenceEncoder = await tensorflow.load();
    }
  }

  async getEmbeddings(str: string[]): Promise<number[][]> {
    if (!this.sentenceEncoder) {
      throw new Error("Load tensorflow first");
    }
    const embeddings = await this.sentenceEncoder.embed(str);
    const data = await embeddings.array();
    return data;
  }
}

const embeddingGenerator = new TensorFlowEmbeddingGenerator();

export function degree_power(A: tf.Tensor, k: number): tf.Tensor {
  const degrees: tf.Tensor = tf.pow(tf.sum(A, 1), k);
  const D: tf.Tensor = tf.diag(degrees);
  return D;
}

export function normalized_adjacency(A: tf.Tensor): tf.Tensor {
  const normalized_D: tf.Tensor = degree_power(A, -0.5);
  return normalized_D.dot(A).dot(normalized_D);
}

export async function text_rank(sentences: string[]): Promise<tf.Tensor> {
  const embeddings = await Promise.all(
    sentences.map(
      async (sentence) =>
        (
          await embeddingGenerator.getEmbeddings([sentence])
        )[0]
    )
  );

  const vectors: tf.Tensor[] = embeddings.map((vector) => {
    return tf.tensor(vector);
  });

  let adjacency: tf.Tensor = tf.stack(
    await Promise.all(
      vectors.map(async (a) => {
        const c = await Promise.all(
          vectors.map(async (b) => {
            // Computing cosine similarity here
            const cosignProximity =
              1 + ((await tf.metrics.cosineProximity(a, b).array()) as number);
            return Math.max(0, 1 - cosignProximity);
          })
        );
        return tf.tensor(c);
      })
    )
  );

  // Set diagonal to zero
  adjacency = adjacency.mul(
    tf.ones(adjacency.shape).sub(tf.eye(adjacency.shape[0]))
  );

  return normalized_adjacency(adjacency);
}

// Brute force way to extract sentences and ranges from the document
function get_sentences(source_text: string): {
  sentences: string[];
  sentence_ranges: [number, number][];
} {
  const sentenceRegex = /(?<sentence>(?:[^.!?"]|"(?:[^"\\]|\\.)*")*[.!?])/g;
  const sentences: string[] = [];
  const sentence_ranges: [number, number][] = [];

  let match;
  while ((match = sentenceRegex.exec(source_text)) !== null) {
    const sentence = match.groups?.sentence.trim();
    if (!sentence) {
      continue;
    }

    const start = match.index + (match[0].startsWith(" ") ? 1 : 0);
    const end = match.index + sentence.length + 1;
    sentences.push(sentence);
    sentence_ranges.push([start, end]);
  }

  return { sentences, sentence_ranges };
}

export async function extract(source_text: string) {
  await embeddingGenerator.load();
  const { sentences, sentence_ranges } = get_sentences(source_text);
  const adjacency = await text_rank(sentences);
  return { sentence_ranges, adjacency };
}
