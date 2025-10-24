import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Poll the status of an image generation job. In a production deployment this
 * endpoint would look up the job in a queue or database and return its
 * completion status along with any generated artifacts (CID, txid, sha256). As
 * a placeholder it always returns a pending state.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  res.status(200).json({
    status: 'pending',
    imageURL: null,
    imageSHA256: null,
    cid: null,
    txid: null,
    manifest: null,
    timeAnchor: null,
    jobId: id,
  });
}
