import Head from 'next/head';
import { GetServerSideProps } from 'next';

interface Props {
  id: string;
}

/**
 * Dynamic route that returns meta tags for Farcaster frames. This component
 * renders no visible content; it only defines OpenGraph and frame metadata in
 * the document head. Use `getServerSideProps` to pass the tokenId as a prop.
 */
export default function FramePage({ id }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const previewUrl = `${baseUrl}/api/frame/preview?tokenId=${id}`;
  const postUrl = `${baseUrl}/api/frame/action`;
  return (
    <>
      <Head>
        <meta property="og:title" content={`Base Persona #${id}`} />
        <meta property="og:image" content={previewUrl} />
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content={previewUrl} />
        <meta name="fc:frame:button:1" content="Preview" />
        <meta name="fc:frame:button:2" content="Mint" />
        <meta name="fc:frame:post_url" content={postUrl} />
      </Head>
      {/* Empty body: the content is handled by the frame specification */}
      <div></div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const { id } = context.params as { id: string };
  return { props: { id } };
};
