import Image from 'next/image';
import Link from 'next/link';
import Logo from '@/public/logo.png';
import HeaderNav from './HeaderNav';

const Header = () => (
  <header className="relative border-b-4 border-black flex flex-row items-center justify-between top-0 bg-white z-50">
    <div className="w-1/2 md:w-1/3 flex md:justify-center items-center gap-4">
      <Link href="/" title="Home Drum & Bass Chile" className="md:hover:scale-125 transition-transform duration-150">
        <Image width={1536} height={1080} src={Logo} alt="logo drum & bass chile" className="max-h-30 md:max-h-50 w-auto" />
      </Link>
    </div>
    <div className="w-1/2 md:w-1/3 flex justify-end md:justify-center items-center px-6 md:px-0">
    <HeaderNav />
    </div>
  </header> 
)

export default Header;