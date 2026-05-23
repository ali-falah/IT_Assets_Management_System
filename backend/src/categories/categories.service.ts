import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  async onModuleInit() {
    // Populate missing icons/colors for existing categories
    const categories = await this.categoriesRepository.find();
    for (const cat of categories) {
      // Re-scan if it has the default 'package' icon to see if our new expanded intelligence can find a better match
      if (cat.icon === 'package' || !cat.icon || cat.color === 'slate' || !cat.color) {
        const suggestion = this.suggestIconAndColor(cat.name);
        if (suggestion.icon !== 'package') {
          cat.icon = suggestion.icon;
          cat.color = suggestion.color;
          await this.categoriesRepository.save(cat);
        }
      }
    }
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoriesRepository.findOne({ where: { name: createCategoryDto.name } });
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }
    
    const { icon, color } = this.suggestIconAndColor(createCategoryDto.name);
    const category = this.categoriesRepository.create({
      ...createCategoryDto,
      icon: createCategoryDto.icon || icon,
      color: createCategoryDto.color || color
    });
    return this.categoriesRepository.save(category);
  }

  private suggestIconAndColor(name: string): { icon: string, color: string } {
    const term = name.toLowerCase();
    
    // Smart mapping dictionary - ORDER MATTERS (most specific first)
    const mappings: { keywords: string[], icon: string, color: string }[] = [
      // 1. High Priority / Specific Models
      { keywords: ['ups', 'battery', 'power bank', 'apc', 'eaton', 'surge', 'c1500', 'bx1100'], icon: 'battery', color: 'orange' },
      { keywords: ['latitude', 'vostro', 'thinkpad', 'macbook', 'laptop', 'notebook', 'precision laptop', 'xps'], icon: 'laptop', color: 'blue' },
      { keywords: ['dock', 'station', 'wd15', 'wd19', 'wd22', 'replicator', 'hub'], icon: 'plug', color: 'amber' },
      
      // 2. Networking & Infrastructure
      { keywords: ['access point', 'unifi ap', 'wifi', 'wireless', 'aruba'], icon: 'wifi', color: 'sky' },
      { keywords: ['switch', 'router', 'firewall', 'cisco', 'fortinet', 'mikrotik'], icon: 'router', color: 'violet' },
      { keywords: ['server', 'rack', 'nas', 'poweredge', 'proliant'], icon: 'server', color: 'purple' },
      
      // 3. Security & Access
      { keywords: ['access control', 'shield', 'security', 'firewall', 'fortigate'], icon: 'shield', color: 'emerald' },
      { keywords: ['camera', 'webcam', 'cctv', 'hikvision', 'dahua', 'axis'], icon: 'camera', color: 'orange' },
      
      // 4. Office Equipment
      { keywords: ['shredder', 'cutter', 'trimmer'], icon: 'trash-2', color: 'slate' },
      { keywords: ['printer', 'scanner', 'copier', 'hp laserjet', 'canon', 'epson', 'pixma'], icon: 'printer', color: 'rose' },
      { keywords: ['projector', 'epson projector', 'benq projector'], icon: 'projector', color: 'rose' },
      { keywords: ['furniture', 'desk', 'chair', 'table', 'armchair'], icon: 'armchair', color: 'brown' },
      
      // 5. General Computing
      { keywords: ['optiplex', 'prodesk', 'elitedesk', 'thinkcentre', 'pc', 'desktop', 'workstation', 'tower', 'precision tower', 'imac'], icon: 'monitor', color: 'indigo' },
      { keywords: ['monitor', 'screen', 'display', 'tv', 'panel', 'viewsonic', 'benq', 'lg tv', 'sonashi'], icon: 'tv', color: 'cyan' },
      { keywords: ['phone', 'mobile', 'smartphone', 'iphone', 'android', 'voip', 'ip phone'], icon: 'smartphone', color: 'emerald' },
      { keywords: ['tablet', 'ipad', 'surface pro'], icon: 'tablet', color: 'teal' },
      
      // 6. Accessories & Peripherals
      { keywords: ['keyboard', 'mouse', 'trackpad', 'logitech', 'mx master'], icon: 'mouse-pointer', color: 'slate' },
      { keywords: ['cable', 'charger', 'power', 'cord', 'hdmi', 'vga', 'usb-c', 'adapter'], icon: 'cable', color: 'amber' },
      { keywords: ['audio', 'speaker', 'headset', 'mic', 'headphones', 'jabra', 'poly'], icon: 'headphones', color: 'fuchsia' },
      { keywords: ['storage', 'drive', 'usb', 'ssd', 'hdd', 'external drive', 'crucial'], icon: 'hard-drive', color: 'sky' },
      { keywords: ['component', 'cpu', 'ram', 'memory', 'motherboard', 'gpu'], icon: 'cpu', color: 'slate' },
      { keywords: ['bag', 'case', 'briefcase', 'backpack', 'sleeve'], icon: 'briefcase', color: 'brown' },
      { keywords: ['license', 'key', 'product key', 'activation'], icon: 'key', color: 'amber' },
      { keywords: ['software', 'app', 'microsoft 365', 'adobe'], icon: 'package', color: 'pink' }
    ];

    for (const mapping of mappings) {
      if (mapping.keywords.some(k => term.includes(k))) {
        return { icon: mapping.icon, color: mapping.color };
      }
    }

    return { icon: 'package', color: 'slate' };
  }

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.find();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    Object.assign(category, updateCategoryDto);
    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoriesRepository.remove(category);
  }

  async getOrCreate(name: string): Promise<Category> {
    const existing = await this.categoriesRepository.findOne({ where: { name } });
    if (existing) return existing;
    return this.create({ name });
  }

  async identifyAndGetCategory(assetName: string): Promise<Category> {
    const suggestion = this.suggestIconAndColor(assetName);
    const categoryName = this.inferCategoryName(assetName, suggestion.icon);
    return await this.getOrCreate(categoryName);
  }

  private inferCategoryName(assetName: string, icon: string): string {
    const nameMap: Record<string, string> = {
      'laptop': 'Laptops',
      'monitor': 'Desktops/PCs',
      'smartphone': 'Mobile Phones',
      'tablet': 'Tablets',
      'tv': 'Displays/TVs',
      'printer': 'Printers/Scanners',
      'server': 'Servers',
      'router': 'Network Devices',
      'trash-2': 'Office Equipment',
      'wifi': 'Access Points',
      'battery': 'UPS/Power',
      'cpu': 'Components',
      'plug': 'Docking Stations',
      'camera': 'Cameras',
      'mouse-pointer': 'Peripherals',
      'cable': 'Cables/Adapters',
      'headphones': 'Audio/Headsets',
      'hard-drive': 'Storage',
      'briefcase': 'Accessories/Bags',
      'package': 'General Assets'
    };
    return nameMap[icon] || 'General Assets';
  }
}
