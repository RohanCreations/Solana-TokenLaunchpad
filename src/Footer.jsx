import React from 'react'
import { motion } from 'framer-motion'
import { BsGithub, BsLinkedin, BsTwitter } from 'react-icons/bs'
export default function Footer() {
    const socialLinks = [
        { name: 'LinkedIn', icon: BsLinkedin, url: 'https://www.linkedin.com/in/rohan-singla100' },
        { name: 'Twitter', icon: BsTwitter, url: 'https://x.com/rohanBuilds' },
        { name: 'GitHub', icon: BsGithub, url: 'https://github.com/rohan-singla' },
    ]

    return (
        <footer className="bg-black text-white py-4 border-t border-white/10 mt-10">
            <div className="container mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center justify-between space-y-4"
                >
                    <div className="flex space-x-6">
                        <p className="text-xl text-center">Connect with me on:</p>
                        {socialLinks.map((link) => (
                            <motion.div
                                key={link.name}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <a href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="text-white hover:text-gray-300 transition-colors"
                                    aria-label={`Connect on ${link.name}`}
                                >
                                    <link.icon className="w-6 h-6" />
                                </a>
                            </motion.div>
                        ))}
                    </div>
                    <p className="text-xl text-gray-400 mt-4">
                        © {new Date().getFullYear()} Rohan Singla. All rights reserved.
                    </p>
                </motion.div>
            </div>
        </footer>
    )
}