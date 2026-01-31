import Image from 'next/image';
import Link from 'next/link';
import Logo from '@/public/logo.png';
import HeaderNav from './HeaderNav';

const Header = () => (
  <header className="relative border-b-4 border-black flex flex-row items-center justify-between top-0 bg-black z-50">
    <div className="w-1/2 lg:w-1/3 flex items-center gap-4 py-2 px-4 md:p-6">
      <Link href="/" title="Home Drum & Bass Chile" className="">
        <Image width={890} height={395} src={Logo} alt="logo drum & bass chile" className="w-40 md:w-80" />
      </Link>
    </div>
    <div className="w-1/2 lg:w-2/3 flex justify-end items-center px-2 md:px-0">
      <HeaderNav />
    </div>
  </header> 
)

export default Header;