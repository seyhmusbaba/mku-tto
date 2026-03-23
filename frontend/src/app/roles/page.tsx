'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { rolesApi } from '@/lib/api';
import { Role, Permission } from '@/types';
import { ROLE_COLORS } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role|null>(null);
  const [form, setForm] = useState({name:'',description:'',permissionIds:[] as string[]});

  const load = () => Promise.all([rolesApi.getAll(), rolesApi.getPermissions()])
    .then(([r,p]) => { setRoles(r.data); setPermissions(p.data); });

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  const openAdd = () => { setEditRole(null); setForm({name:'',description:'',permissionIds:[]}); setShowModal(true); };
  const openEdit = (r: Role) => { setEditRole(r); setForm({name:r.name,description:r.description||'',permissionIds:r.permissions?.map(p=>p.id)||[]}); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editRole) {
        await rolesApi.update(editRole.id, form);
        toast.success('Rol güncellendi');
      } else {
        await rolesApi.create(form);
        toast.success('Rol oluşturuldu');
      }
      setShowModal(false);
      await load();
    } catch(err:any) { toast.error(err.response?.data?.message || 'Hata oluştu'); }
  };

  const handleDelete = async (id: string, isSystem: number) => {
    if (isSystem) return toast.error('Sistem rolleri silinemez');
    if (!confirm('Bu rolü silmek istiyor musunuz?')) return;
    try {
      await rolesApi.delete(id);
      toast.success('Rol silindi');
      await load();
    } catch(err:any) { toast.error(err.response?.data?.message || 'Bu rol kullanımda olduğundan silinemiyor'); }
  };

  const togglePerm = (id: string) => setForm(f => ({
    ...f, permissionIds: f.permissionIds.includes(id) ? f.permissionIds.filter(p=>p!==id) : [...f.permissionIds,id]
  }));

  const modules = Array.from(new Set(permissions.map(p => p.module)));

  return (
    <DashboardLayout>
      <Header title="Roller & Yetkiler" subtitle="Kullanıcı rollerini ve erişim yetkilerini yönetin"
        actions={<button onClick={openAdd} className="btn-primary">+ Yeni Rol</button>} />

      <div className="p-8">
        {loading ? <div className="flex justify-center py-20"><div className="spinner"/></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles.map(role => {
              const roleStyle = ROLE_COLORS[role.name] || { bg: '#f0ede8', text: '#6b7280', border: '#e8e4dc' };
              return (
                <div key={role.id} className="card-hover flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                      style={{background:`linear-gradient(135deg, ${roleStyle.text}, ${roleStyle.text}cc)`}}>
                      {role.name[0]}
                    </div>
                    <div className="flex gap-2 items-center">
                      {role.isSystem ? <span className="badge badge-gold text-xs">Sistem</span> : null}
                      <button onClick={() => openEdit(role)} className="btn-secondary text-xs px-2.5 py-1.5">Düzenle</button>
                      <button onClick={() => handleDelete(role.id, role.isSystem)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{background:'#fff0f0',color:'#dc2626'}}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <h3 className="font-display font-semibold text-base mb-1" style={{color: roleStyle.text}}>{role.name}</h3>
                  {role.description && <p className="text-xs text-muted mb-3">{role.description}</p>}
                  <div className="mt-auto pt-3 border-t" style={{borderColor:'#f0ede8'}}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{role.permissions?.length||0} yetki</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions?.slice(0,4).map(p => (
                        <span key={p.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{background:roleStyle.bg, color:roleStyle.text, border:`1px solid ${roleStyle.border}`}}>{p.description||p.action}</span>
                      ))}
                      {(role.permissions?.length||0)>4 && <span className="text-xs px-2 py-0.5 rounded-full text-muted" style={{background:'#f0ede8'}}>+{(role.permissions?.length||0)-4}</span>}
                      {!role.permissions?.length && <span className="text-xs text-muted">Yetki tanımlanmamış</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{border:'1px solid #e8e4dc'}}>
            <div className="p-6 border-b sticky top-0 bg-white z-10" style={{borderColor:'#e8e4dc'}}>
              <h3 className="font-display text-lg font-semibold text-navy">{editRole?'Rolü Düzenle':'Yeni Rol'}</h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div><label className="label">Rol Adı *</label><input required className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className="label">Açıklama</label><input className="input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
              {permissions.length > 0 && (
                <div>
                  <label className="label">Yetkiler ({form.permissionIds.length} seçili)</label>
                  <div className="space-y-3 mt-2">
                    {modules.map(mod=>(
                      <div key={mod} className="rounded-xl p-4" style={{background:'#faf8f4',border:'1px solid #e8e4dc'}}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-navy">{mod}</p>
                          <button type="button" className="text-xs text-muted hover:text-navy" onClick={()=>{
                            const modPerms = permissions.filter(p=>p.module===mod).map(p=>p.id);
                            const allSelected = modPerms.every(id=>form.permissionIds.includes(id));
                            setForm(f=>({...f, permissionIds: allSelected ? f.permissionIds.filter(id=>!modPerms.includes(id)) : Array.from(new Set([...f.permissionIds,...modPerms]))}));
                          }}>Tümü</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {permissions.filter(p=>p.module===mod).map(p=>(
                            <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded-lg p-1.5 transition-colors">
                              <input type="checkbox" checked={form.permissionIds.includes(p.id)} onChange={()=>togglePerm(p.id)} className="w-3.5 h-3.5"/>
                              <span className="text-xs text-muted">{p.description||p.action}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editRole?'Güncelle':'Oluştur'}</button>
                <button type="button" onClick={()=>setShowModal(false)} className="btn-secondary flex-1">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
