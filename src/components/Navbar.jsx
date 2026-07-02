import '../styles/navbar.css'
import logo from '../assets/logo/aurora-logo.svg'

function Navbar() {
    return (
        <nav className="navbar">

            <a href="#" className="navbar-brand">

                <img
                    src={logo}
                    alt="Aurora Logo"
                    className="navbar-logo"
                />

                <span className="navbar-title">
                    Aurora
                </span>

            </a>

            <ul className="navbar-menu">

                <li>
                    <a href="#products">Products</a>
                </li>

                <li>
                    <a href="#development">Development</a>
                </li>

                <li>
                    <a href="#roadmap">Roadmap</a>
                </li>

                <li>
                    <a href="#about">Vision</a>
                </li>

            </ul>

        </nav>
    )
}

export default Navbar