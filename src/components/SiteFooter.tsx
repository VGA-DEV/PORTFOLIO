export function SiteFooter({ rights }: { rights: string }) {
  return (
    <footer className='site-footer'>
      <div className='container'>
        <p>
          © {new Date().getFullYear()} {rights}
        </p>
      </div>
    </footer>
  );
}
