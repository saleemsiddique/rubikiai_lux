import React from 'react'


const Footer: React.FC = () => {
    return (
        <footer className="w-full mt-16 py-8 bg-transparent">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
                <div>© {new Date().getFullYear()} Rubikiai Lux. Todos los derechos reservados.</div>
                <div className="flex gap-4">
                    <a href="#">Términos</a>
                    <a href="#">Privacidad</a>
                </div>
            </div>
        </footer>
    )
}


export default Footer