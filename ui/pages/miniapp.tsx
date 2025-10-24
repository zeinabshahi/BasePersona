/**
 * Mini app route renders the primary flow inside an iframe. This allows the
 * interface to be embedded inside the Base App or other webviews while
 * preserving navigation. If you need a custom mini app UI you can duplicate
 * the Stepper component from index.tsx here and style it separately.
 */
export default function MiniApp() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return (
    <iframe
      src={`${baseUrl}/`}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title="Base Persona Mini App"
      allow="clipboard-write"
    ></iframe>
  );
}
